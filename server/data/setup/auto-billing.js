const {
    SQL,
    query,
} = require('../index');

const claimsData = require('../../data/claim/index');
const claimController = require('../../controllers/claim/index');
const config = require('../../config');
const logger = require('../../../logger');
const COMPANY_ID = 1;
const WILDCARD_ID = "0";
const RADMIN_USER_ID = 1;
const CHARGE_IS_EXCLUDED = false;
const SITE_ID = 1;
const PROBLEM_IS_DELETED = false;
const DEFAULT_BILLING_CLASS_ID = null;
const DEFAULT_BILLING_CODE_ID = null;
const DEFAULT_BILLING_NOTES = "";
const DEFAULT_CLAIM_NOTES = "";
const DEFAULT_PAYER_TYPE = 'patient';
const DEFAULT_BILLING_TYPE = 'global';
const DEFAULT_BILLING_METHOD = 'patient_payment';
const CLIENT_IP = '127.0.0.1';

let _settings = null;

const getSettings = async () => {
    if (!_settings) {
        _settings = (await query(SQL`
            SELECT
                sites.country_alpha_3_code
                , sites.province_alpha_2_code
                , fs.default_provider_id
            FROM
                sites
                CROSS JOIN billing.facility_settings fs
            WHERE
                sites.id=${SITE_ID}
        `)).rows[0];
    }

    return _settings;
};

const getPointer = (problem) => {
    return (problem && problem.order_no) || null;
};

const getSaveClaimParams = async (params) => {

    const {
        patient_id,
        companyId,
        userId,
        claim_dt,
        order_id,
        study_id
    } = params;
    params.claim_date = params.claim_dt;

    const settings = await getSettings();

    const isCanadaBilling = settings.country_alpha_3_code === 'can';
    const isAlbertaBilling = isCanadaBilling && settings.province_alpha_2_code === 'AB';
    const isOhipBilling = isCanadaBilling && settings.province_alpha_2_code === 'ON';
    const isMobileBillingEnabled = settings.country_alpha_3_code === 'usa' && config.get('enableMobileBilling');
    params.isMobileBillingEnabled = isMobileBillingEnabled;

    const patientInsurances = (await claimsData.getPatientInsurances(params)).rows;
    const lineItems = (await claimsData.getLineItemsDetails(params)).rows;

    const problems = lineItems[0].problems;
    const claim_details = lineItems[0].claim_details[0];
    let patBeneficiaryInsurances = patientInsurances[0].beneficiary_details || [];

    patBeneficiaryInsurances = patBeneficiaryInsurances.length && patBeneficiaryInsurances.reduce((acc, value) => {
        // Group initialization
        if (!acc[value.coverage_level]) {
            acc[value.coverage_level] = [];
        }

        acc[value.coverage_level].push(value);
        return acc;
    }, {}) || [];

    const charge_details = lineItems[0].charges.map((charge) => {
        charge.allowed_amount = charge.allowed_fee;
        charge.modifier1_id = charge.m1;
        charge.modifier2_id = charge.m2;
        charge.modifier3_id = charge.m3;
        charge.modifier4_id = charge.m4;
        charge.charge_dt = charge.study_dt;
        charge.created_by = userId;
        charge.pointer1 = getPointer(problems[0]);
        charge.pointer2 = getPointer(problems[1]);
        charge.pointer3 = getPointer(problems[2]);
        charge.pointer4 = getPointer(problems[3]);
        charge.is_excluded = CHARGE_IS_EXCLUDED;
        charge.is_canada_billing = isCanadaBilling;
        charge.is_custom_bill_fee = charge.is_custom_bill_fee || false;
        charge.is_billing_rule_applied = charge.is_billing_rule_applied || false;
        charge.is_billing_rule_cpt_add_fee = charge.is_billing_rule_cpt_add_fee || false;
        return charge;
    });

    let payer_type = DEFAULT_PAYER_TYPE;
    let billing_method = DEFAULT_BILLING_METHOD;
    let place_of_service_id = claim_details.fac_place_of_service_id;
    let insurances = Object.keys(patBeneficiaryInsurances).map((val) => {
        let insurance = val.length ? patBeneficiaryInsurances[val].sort((data) => { return data.id - data.id; })[0] : {};
        insurance.claim_patient_insurance_id = insurance.id;
        insurance.is_update_patient_info = false;
        insurance.patient_id = patient_id;
        return insurance;
    });

    const primary_insurance = insurances.find((val)=> {return val.coverage_level === 'primary';});
    const billing_type = (config.get('enableMobileBilling') && !isCanadaBilling  && claim_details.billing_type) || DEFAULT_BILLING_TYPE;

    if (isMobileBillingEnabled && billing_type == 'facility') {
        payer_type = 'ordering_facility';
        billing_method = 'direct_billing';
        place_of_service_id = claim_details.ord_fac_place_of_service;
    }
    else if (primary_insurance) {
        payer_type = 'primary_insurance';
        billing_method = primary_insurance.billing_method;
    }

    if (isMobileBillingEnabled && billing_type == 'global') {
        place_of_service_id = claim_details.ord_fac_place_of_service;
    }

    const saveClaimParams = {
        removed_charges: [],

        is_alberta_billing: isAlbertaBilling,
        is_ohip_billing: isOhipBilling,
        isMobileBillingEnabled,
        claims: {
            company_id: companyId,
            billing_class_id: DEFAULT_BILLING_CLASS_ID,
            billing_code_id: DEFAULT_BILLING_CODE_ID,
            billing_method,
            billing_notes: DEFAULT_BILLING_NOTES,
            billing_provider_id: claim_details.fac_billing_provider_id || settings.default_provider_id,
            claim_dt,
            claim_notes: DEFAULT_CLAIM_NOTES,
            claim_status_id: params.claim_status_id,
            created_by: userId,
            payer_type,
            patient_id,
            place_of_service_id: isCanadaBilling ? null : place_of_service_id,
            claim_charges: charge_details,
            ...claim_details,
            rendering_provider_contact_id: claim_details.rendering_provider_contact_id || claim_details.fac_rendering_provider_contact_id,
            accident_state: claim_details.accident_state || null,
            service_facility_id: parseInt(claim_details.service_facility_id) || null,
            ordering_facility_id: parseInt(claim_details.ordering_facility_id) || null,
            can_confidential: false,
            can_wcb_rejected: false,
            wcb_injury_area_code: claim_details.area_of_injury_code_id || null,
            wcb_injury_nature_code: claim_details.nature_of_injury_code_id || null,
            billing_type,
            is_insurance_split: claim_details.is_insurance_split,
            ord_fac_place_of_service: claim_details.ord_fac_place_of_service,
            order_id,
            study_id
        },

        insurances,

        claim_icds: problems.map((problem) => {
            return {
                id: null,
                icd_id: problem.id,
                claim_id: null,
                is_deleted: PROBLEM_IS_DELETED,
            };
        }),

        auditDetails: {
            company_id: companyId,
            screen_name: 'system-event',
            module_name: 'claims',
            client_ip: CLIENT_IP,
            user_id: userId
        },
    };

    // special snowflake cases go here
    if (isAlbertaBilling) {
        saveClaimParams.claims.can_ahs_claimed_amount_indicator = false;
        saveClaimParams.claims.can_confidential = false;
        saveClaimParams.claims.can_ahs_paper_supporting_docs = false;
        saveClaimParams.claims.can_ahs_pay_to_code = 'BAPY';
        saveClaimParams.claims.can_ahs_business_arrangement = saveClaimParams.claims.can_ahs_business_arrangement_facility || null;
    }

    saveClaimParams.claims = [saveClaimParams.claims];
    return saveClaimParams;
};

module.exports = {

    getAutobillingRules: async (params) => {

        const {
            autobilling_rule_description,
            study_status,
            claim_status_id,
        } = params;

        let filterQuery = SQL`
            WHERE
                cabr.deleted_dt is null
        `;

        if (autobilling_rule_description) {
            let term = autobilling_rule_description;

            if (term.length === 1) {
                term = '%' + term;
            }

            term += '%';

            filterQuery.append(SQL`
                AND cabr.autobilling_rule_description ILIKE ${term}
            `);
        }

        if (study_status) {
            filterQuery.append(SQL`
                AND ${study_status} = ANY(cabr.study_status_codes)
            `);
        }

        if (claim_status_id && claim_status_id !== WILDCARD_ID) {
            filterQuery.append(SQL`
                AND cabr.claim_status_id = ${claim_status_id}
            `);
        }

        const selectionQuery = SQL`
            WITH cteAutobillingRule AS (
                SELECT
                    abr.id
                    , abr.description               AS autobilling_rule_description
                    , abr.claim_status_id           AS claim_status_id
                    , array_agg(study_status_code)  AS study_status_codes
                    , CASE
                        WHEN abr.inactivated_dt is null THEN true
                        ELSE false
                        END is_active
                    , deleted_dt
                FROM
                    billing.autobilling_rules abr
                    LEFT JOIN billing.autobilling_study_status_rules abssr ON abssr.autobilling_rule_id = abr.id
                GROUP BY abr.id, abr.description
            )
            SELECT
                cabr.id
                , cabr.autobilling_rule_description
                , cabr.claim_status_id
                , cabr.study_status_codes
                , cs.description                        AS claim_status_description
                , cabr.is_active
                , COUNT(1) OVER (range unbounded preceding) AS total_records
            FROM
                cteAutobillingRule cabr
                LEFT JOIN billing.claim_status cs ON cs.id = cabr.claim_status_id
        `;

        return await query(selectionQuery.append(filterQuery).append(SQL`
            ORDER BY cabr.id
        `));
    },

    getAutobillingRule: async (params) => {
        const {
            id,
        } = params;

        const sql = SQL`
            WITH base AS (
                SELECT
                    abr.id                                          AS autobilling_rule_id
                    , abr.description                               AS autobilling_rule_description
                    , abr.claim_status_id                           AS claim_status_id
                    , CASE
                        WHEN abr.inactivated_dt is null THEN true
                        ELSE false
                        END                                         is_active
                    , array_agg(DISTINCT study_status_code)       AS study_status_codes
                    , abssr.excludes                              AS exclude_study_statuses
                    , array_agg(facility_id)                      AS facility_ids
                    , abfr.excludes                               AS exclude_facilities
                    , array_agg(abofr.ordering_facility_id)       AS ordering_facility_ids
                    , abofr.excludes                              AS exclude_ordering_facilities
                    , array_agg(modality_id)                      AS modality_ids
                    , abmr.excludes                               AS exclude_modalities
                    , array_agg(cpt_code_id)                      AS cpt_code_ids
                    , abcptr.excludes                             AS exclude_cpt_codes
                    , array_agg(insurance_provider_payer_type_id) AS insurance_provider_payer_type_ids
                    , abipptr.excludes                            AS exclude_insurance_provider_payer_types
                    , array_agg(insurance_provider_id)            AS insurance_provider_ids
                    , abipr.excludes                              AS exclude_insurance_providers

                 FROM
                      billing.autobilling_rules abr
                      LEFT JOIN billing.autobilling_study_status_rules abssr                        ON abr.id = abssr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_facility_rules abfr                             ON abr.id = abfr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_ordering_facility_rules abofr                  ON abr.id = abofr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_modality_rules abmr                             ON abr.id = abmr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_cpt_code_rules abcptr                           ON abr.id = abcptr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_insurance_provider_payer_type_rules abipptr     ON abr.id = abipptr.autobilling_rule_id
                      LEFT JOIN billing.autobilling_insurance_provider_rules abipr                  ON abr.id = abipr.autobilling_rule_id
                  WHERE
                       abr.id = ${id}
                 GROUP BY
                      abr.id
                      , abssr.excludes
                      , abfr.excludes
                      , abofr.excludes
                      , abmr.excludes
                      , abcptr.excludes
                      , abipptr.excludes
                      , abipr.excludes
            )
            SELECT
                autobilling_rule_id
                , autobilling_rule_description
                , base.claim_status_id
                , is_active
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT DISTINCT ON (status_code) id, status_desc, status_code
                      FROM study_status INNER JOIN base ON study_status.status_code = ANY(base.study_status_codes)
                 ) tmp) as study_statuses
                 , exclude_study_statuses
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT id, facility_name, facility_code
                      FROM facilities INNER JOIN base ON facilities.id = ANY(base.facility_ids)
                 ) tmp) as facilities
                 , exclude_facilities
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                    SELECT
                         id
                         , name AS ordering_facility_name
                         , code AS ordering_facility_code
                    FROM ordering_facilities INNER JOIN base ON ordering_facilities.id = ANY(base.ordering_facility_ids)
               ) tmp) AS ordering_facilities
               , exclude_ordering_facilities
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT id, display_description, display_code
                      FROM cpt_codes INNER JOIN base ON cpt_codes.id = ANY(base.cpt_code_ids)
                 ) tmp) as cpt_codes
                 , exclude_cpt_codes
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT id, modality_name, modality_code
                      FROM modalities INNER JOIN base ON modalities.id = ANY(base.modality_ids)
                 ) tmp) as modalities
                 , exclude_modalities
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT id, description, code
                      FROM insurance_provider_payer_types INNER JOIN base ON insurance_provider_payer_types.id = ANY(base.insurance_provider_payer_type_ids)
                 ) tmp) as insurance_provider_payer_types
                 , exclude_insurance_provider_payer_types
                 , (SELECT array_to_json(array_agg(tmp)) FROM (
                      SELECT id, insurance_name, insurance_code
                      FROM insurance_providers INNER JOIN base ON insurance_providers.id = ANY(base.insurance_provider_ids)
                 ) tmp) as insurance_providers
                 , exclude_insurance_providers
            FROM base
        `;

        return await query(sql);
    },

    createAutobillingRule: async (params) => {

        const {
            description,
            claim_status_id,
            inactive,
            userId,
            screenName,
            moduleName,
            clientIp,
            companyId,
            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

            ordering_facility_ids,
            exclude_ordering_facilities,

            modality_ids,
            exclude_modalities,

            cpt_code_ids,
            exclude_cpt_codes,

            insurance_provider_payer_type_ids,
            exclude_insurance_provider_payer_types,

            insurance_provider_ids,
            exclude_insurance_providers,
        } = params;

        const sql = SQL`
            WITH abrInsert AS (
                INSERT INTO billing.autobilling_rules (
                    description
                    , claim_status_id
                    , inactivated_dt
                    , created_by
                )
                VALUES (
                    ${description}
                    , ${claim_status_id}
                    , ${inactive ? 'now()' : null }
                    , ${userId}
                )
                RETURNING id,  row_to_json(billing.autobilling_rules.*) AS new_values
                , '{}'::jsonb old_values
            )
            , studyStatusesInsert AS (
                INSERT INTO billing.autobilling_study_status_rules (
                    autobilling_rule_id
                    , study_status_code
                    , excludes
                )
                VALUES (
                    (SELECT id FROM abrInsert)
                    , UNNEST(${study_status_codes}::text[])
                    , ${exclude_study_statuses}
                )
            )
            , facilitiesInsert AS (
                INSERT INTO billing.autobilling_facility_rules (
                    autobilling_rule_id
                    , facility_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${facility_ids}::int[])
                    , ${exclude_facilities}
                )
            )
            , orderingFacilitiesInsert AS (
                INSERT INTO billing.autobilling_ordering_facility_rules (
                    autobilling_rule_id
                    , ordering_facility_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${ordering_facility_ids}::int[])
                    , ${exclude_ordering_facilities}
                )
            )
            , modalitiesInsert AS (
                INSERT INTO billing.autobilling_modality_rules (
                    autobilling_rule_id
                    , modality_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${modality_ids}::int[])
                    , ${exclude_modalities}
                )
            )
            , cptCodesInsert AS (
                INSERT INTO billing.autobilling_cpt_code_rules (
                    autobilling_rule_id
                    , cpt_code_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${cpt_code_ids}::int[])
                    , ${exclude_cpt_codes}
                )
            )
            , insuranceProviderPayerTypesInsert AS (
                INSERT INTO billing.autobilling_insurance_provider_payer_type_rules (
                    autobilling_rule_id
                    , insurance_provider_payer_type_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${insurance_provider_payer_type_ids}::int[])
                    , ${exclude_insurance_provider_payer_types}
                )
            )
            , insuranceProvidersInsert AS (
                INSERT INTO billing.autobilling_insurance_provider_rules (
                    autobilling_rule_id
                    , insurance_provider_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${insurance_provider_ids}::int[])
                    , ${exclude_insurance_providers}
                )
            )
            SELECT
                id
                , billing.create_audit (
                      ${companyId}
                    , ${screenName}
                    , abrInsert.id
                    , ${screenName}
                    , ${moduleName}
                    , 'Auto billing Rule created ID:' || abrInsert.id
                    , ${clientIp}
                    , json_build_object(
                        'old_values', COALESCE(abrInsert.old_values, '{}'),
                        'new_values', COALESCE(abrInsert.new_values, '{}')
                      )::jsonb
                    , ${userId}
                ) audit_id
        FROM abrInsert
        `;
        return await query(sql);
    },

    updateAutobillingRule: async (params) => {
        const {
            id,
            description,
            claim_status_id,
            inactive,

            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

            ordering_facility_ids,
            exclude_ordering_facilities,

            modality_ids,
            exclude_modalities,

            cpt_code_ids,
            exclude_cpt_codes,

            insurance_provider_payer_type_ids,
            exclude_insurance_provider_payer_types,

            insurance_provider_ids,
            exclude_insurance_providers,

            screenName,
            moduleName,
            clientIp,
            userId,
            companyId,
        } = params;


        const sql = SQL`
            WITH
                old_audit AS (
                    SELECT row_to_json(row) AS old_values
                    FROM (
                        SELECT
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'study_status_code', study_status_code,
                                            'excludes', excludes
                                    ))::TEXT AS study_status_list
                                FROM billing.autobilling_study_status_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS study_status,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'facility_id', facility_id,
                                            'excludes', excludes
                                    ))::TEXT AS facility_list
                                FROM billing.autobilling_facility_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS facility,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'modality_id', modality_id,
                                            'excludes', excludes
                                    ))::TEXT AS modality_list
                                FROM billing.autobilling_modality_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS modality,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'cpt_code_id', cpt_code_id,
                                            'excludes', excludes
                                    ))::TEXT AS cpt_list
                                FROM billing.autobilling_cpt_code_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS cpt,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'insurance_provider_payer_type_id', insurance_provider_payer_type_id,
                                            'excludes', excludes
                                    ))::TEXT AS insurance_list
                                FROM billing.autobilling_insurance_provider_payer_type_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS insurance,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'insurance_provider_id', insurance_provider_id,
                                            'excludes', excludes
                                    ))::TEXT AS insurance_provider_list
                                FROM billing.autobilling_insurance_provider_rules
                                WHERE autobilling_rule_id = ${id}
                           ) AS insurance_provider,
                           (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'ordering_facility_id', ordering_facility_id,
                                            'excludes', excludes
                                    ))::TEXT AS ordering_facility_list
                                FROM billing.autobilling_ordering_facility_rules
                                WHERE autobilling_rule_id = ${id}
                            ) AS ordering_facility
                    ) row
                )
                , facilitiesCleanSlate AS (
                    DELETE FROM billing.autobilling_facility_rules WHERE autobilling_rule_id = ${id}
                )
                , studyStatusesCleanSlate AS (
                    DELETE FROM billing.autobilling_study_status_rules WHERE autobilling_rule_id = ${id}
                )
                , modalitiesCleanSlate AS (
                    DELETE FROM billing.autobilling_modality_rules WHERE autobilling_rule_id = ${id}
                )
                , cptCodesCleanSlate AS (
                    DELETE FROM billing.autobilling_cpt_code_rules WHERE autobilling_rule_id = ${id}
                )
                , insuranceProviderPayerTypesCleanSlate AS (
                    DELETE FROM billing.autobilling_insurance_provider_payer_type_rules WHERE autobilling_rule_id = ${id}
                )
                , insuranceProvidersCleanSlate AS (
                    DELETE FROM billing.autobilling_insurance_provider_rules WHERE autobilling_rule_id = ${id}
                )

                , studyStatusesInsert AS (
                    INSERT INTO billing.autobilling_study_status_rules (
                        autobilling_rule_id
                        , study_status_code
                        , excludes
                    )
                    VALUES (
                        ${id}
                        , UNNEST(${study_status_codes}::text[])
                        , ${exclude_study_statuses}
                    )
                    RETURNING *
                )
                , facilitiesInsert AS (
                    INSERT INTO billing.autobilling_facility_rules (
                        autobilling_rule_id
                        , facility_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${facility_ids}::int[])
                        , ${exclude_facilities}
                    )
                    RETURNING *
                )
                , modalitiesInsert AS (
                    INSERT INTO billing.autobilling_modality_rules (
                        autobilling_rule_id
                        , modality_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${modality_ids}::int[])
                        , ${exclude_modalities}
                    )
                    RETURNING *
                )
                , cptCodesInsert AS (
                    INSERT INTO billing.autobilling_cpt_code_rules (
                        autobilling_rule_id
                        , cpt_code_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${cpt_code_ids}::int[])
                        , ${exclude_cpt_codes}
                    )
                    RETURNING *
                )
                , insuranceProviderPayerTypesInsert AS (
                    INSERT INTO billing.autobilling_insurance_provider_payer_type_rules (
                        autobilling_rule_id
                        , insurance_provider_payer_type_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${insurance_provider_payer_type_ids}::int[])
                        , ${exclude_insurance_provider_payer_types}
                    )
                    RETURNING *
                )
                , insuranceProvidersInsert AS (
                    INSERT INTO billing.autobilling_insurance_provider_rules (
                        autobilling_rule_id
                        , insurance_provider_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${insurance_provider_ids}::int[])
                        , ${exclude_insurance_providers}
                    )
                    RETURNING *
                )
                , updateExcludesOrderingFacilities AS (
                    UPDATE billing.autobilling_ordering_facility_rules SET excludes = ${exclude_ordering_facilities}
                    WHERE autobilling_rule_id = ${id}
                 )
                , deleteOrderingFacilityRules AS (
                    DELETE FROM billing.autobilling_ordering_facility_rules
                    WHERE autobilling_rule_id = ${id}
                    AND ordering_facility_id != ALL(${ordering_facility_ids}::BIGINT[])
                )
                , insertOrderingFacilityRules AS (
                    INSERT INTO billing.autobilling_ordering_facility_rules (
                     autobilling_rule_id,
                     excludes,
                     ordering_facility_id
                    )
                    SELECT
                          ${id},
                          ${exclude_ordering_facilities},
                          ofs.of_id
                    FROM UNNEST(${ordering_facility_ids}::BIGINT[]) ofs(of_id)
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM billing.autobilling_ordering_facility_rules
                        WHERE ordering_facility_id = ofs.of_id
                        AND autobilling_rule_id = ${id})
                        RETURNING *
                )
                , update_cte AS (
                    UPDATE billing.autobilling_rules
                    SET
                        description = ${description}
                        , claim_status_id = ${claim_status_id}
                        , inactivated_dt = ${inactive ? "now()": null}
                    WHERE
                        id = ${id}
                    RETURNING id
                )
                , new_audit AS (
                    SELECT row_to_json(row) AS new_values
                    FROM (
                        SELECT
                            (
                                SELECT JSONB_AGG(
                                    JSONB_BUILD_OBJECT(
                                        'study_status_code', study_status_code,
                                        'excludes', excludes
                                    ))::TEXT AS study_status_list
                                FROM studyStatusesInsert
                            ) AS study_status,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'facility_id', facility_id,
                                            'excludes', excludes
                                    ))::TEXT AS facility_list
                                FROM facilitiesInsert
                            ) AS facility,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'modality_id', modality_id,
                                            'excludes', excludes
                                    ))::TEXT AS modality_list
                                FROM modalitiesInsert
                            ) AS modality,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'cpt_code_id', cpt_code_id,
                                            'excludes', excludes
                                    ))::TEXT AS cpt_list
                                FROM cptCodesInsert
                            ) AS cpt,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'insurance_provider_payer_type_id', insurance_provider_payer_type_id,
                                            'excludes', excludes
                                    ))::TEXT AS insurance_list
                                FROM insuranceProviderPayerTypesInsert
                            ) AS insurance,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'insurance_provider_id', insurance_provider_id,
                                            'excludes', excludes
                                    ))::TEXT AS insurance_provider_list
                                FROM insuranceProvidersInsert
                            ) AS insurance_provider,
                            (
                                SELECT
                                    JSONB_AGG(
                                        JSONB_BUILD_OBJECT(
                                            'ordering_facility_id', ordering_facility_id,
                                            'excludes', excludes
                                    ))::TEXT AS ordering_facility_list
                                FROM insertOrderingFacilityRules
                            ) AS ordering_facility

                    ) row

                )
                SELECT
                    uc.id,
                    billing.create_audit(
                       ${companyId || 1}
                        , ${screenName}
                        , uc.id
                        , ${screenName}
                        , ${moduleName}
                        , 'Auto billing Updated Id: ' || uc.id
                        , ${clientIp || '127.0.0.1'}
                                , json_build_object(
                                    'old_values', COALESCE((select old_values FROM old_audit), '{}'),
                                    'new_values', COALESCE((select new_values FROM new_audit), '{}')
                                  )::jsonb
                        , ${userId || 1}
                    ) AS audit_id
                FROM update_cte uc `;

        return await query(sql);
    },

    deleteAutobillingRule: async (params) => {
        const {
            id,
            screenName,
            moduleName,
            clientIp,
            userId,
            companyId
        } = params;

        const sql = SQL`
        WITH purge_cte AS (
            UPDATE billing.autobilling_rules
            SET
                deleted_dt = now()
            WHERE
                id = ${id}
            RETURNING id,  row_to_json(billing.autobilling_rules.*) AS new_values
            , '{}'::jsonb old_values
        )
        SELECT billing.create_audit(
            ${companyId || 1}
          , ${screenName}
          , pc.id
          , ${screenName}
          , ${moduleName}
          , 'Auto billing Deleted Id: ' || pc.id
          , ${clientIp || '127.0.0.1'}
                  , json_build_object(
                      'old_values', COALESCE(pc.old_values, '{}'),
                      'new_values', COALESCE(pc.new_values, '{}')
                    )::jsonb
          , ${userId || 1}
          ) AS audit_id
          FROM purge_cte pc
        `;
        return await query(sql);
    },

    executeAutobillingRules: async (params) => {
        const {
            studyId,
            studyStatus,
            patientId,
            orderId,
        } = params;

        const sql = SQL`
            WITH cteAutoBillingRules AS (
                SELECT
                    abr.id
                    , claim_status_id
                    , array_agg(abssr.study_status_code)            AS study_status_codes
                    , abssr.excludes                                AS exclude_study_statuses
                    , array_agg(facility_id)                        AS facility_ids
                    , abfr.excludes                                 AS exclude_facilities
                    , array_agg(abofr.ordering_facility_id)         AS ordering_facility_ids
                    , abofr.excludes                                AS exclude_ordering_facilities
                    , array_agg(modality_id)                        AS modality_ids
                    , abmr.excludes                                 AS exclude_modalities
                    , array_agg(cpt_code_id)                        AS cpt_code_ids
                    , abcptr.excludes                               AS exclude_cpt_codes
                    , array_agg(insurance_provider_payer_type_id)   AS insurance_provider_payer_type_ids
                    , abipptr.excludes                              AS exclude_insurance_provider_payer_types
                    , array_agg(insurance_provider_id)              AS insurance_provider_ids
                    , abipr.excludes                                AS exclude_insurance_providers

                FROM
                    billing.autobilling_rules abr
                    LEFT JOIN billing.autobilling_study_status_rules abssr                      ON abr.id = abssr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_facility_rules abfr                           ON abr.id = abfr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_ordering_facility_rules abofr                 ON abr.id = abofr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_modality_rules abmr                           ON abr.id = abmr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_cpt_code_rules abcptr                         ON abr.id = abcptr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_insurance_provider_payer_type_rules abipptr   ON abr.id = abipptr.autobilling_rule_id
                    LEFT JOIN billing.autobilling_insurance_provider_rules abipr                ON abr.id = abipr.autobilling_rule_id
                WHERE
                    inactivated_dt IS NULL
                    AND deleted_dt IS NULL
                GROUP BY
                    abr.id
                    , abssr.excludes
                    , abfr.excludes
                    , abofr.excludes
                    , abmr.excludes
                    , abcptr.excludes
                    , abipptr.excludes
                    , abipr.excludes
            )
            , context AS (
                SELECT
                    studies.facility_id
                    , studies.modality_id
                    , studies.study_dt
                    , array_agg(study_cpt.cpt_code_id)              AS cpt_code_ids
                    , insurance_providers.provider_payer_type_id    AS insurance_provider_payer_type_id
                    , insurance_providers.id                        AS insurance_provider_id
                    , pofc.ordering_facility_id
                FROM
                    studies
                    LEFT JOIN study_cpt             ON study_cpt.study_id = studies.id
                    LEFT JOIN patient_insurances    ON patient_insurances.patient_id = studies.patient_id
                    LEFT JOIN insurance_providers   ON insurance_providers.id = patient_insurances.insurance_provider_id
                    LEFT JOIN ordering_facility_contacts pofc ON pofc.id = studies.ordering_facility_contact_id

                WHERE
                    studies.id = ${studyId}
                    AND NOT EXISTS (
                        SELECT 1
                        FROM billing.claims bc
                        JOIN billing.charges bch
                            ON bch.claim_id = bc.id
                        JOIN billing.charges_studies bchs
                            ON bchs.charge_id = bch.id
                        WHERE
                            bchs.study_id = ${studyId}
                    )

                GROUP BY
                    studies.facility_id
                    , studies.modality_id
                    , insurance_providers.provider_payer_type_id
                    , insurance_providers.id
                    , studies.study_dt
                    , pofc.ordering_facility_id
            )
            SELECT
            *
            FROM
            cteAutoBillingRules
            INNER JOIN context ON
                (NOT exclude_study_statuses = (${studyStatus} = ANY(study_status_codes)))
                AND
                (exclude_facilities IS null OR NOT exclude_facilities = (context.facility_id = ANY(facility_ids)))
                AND (
                    exclude_ordering_facilities IS NULL
                    OR NOT (exclude_ordering_facilities = COALESCE((context.ordering_facility_id = ANY(cteAutoBillingRules.ordering_facility_ids)), false))
                )
                AND
                (exclude_modalities IS null OR NOT exclude_modalities = (context.modality_id = ANY(modality_ids)))
                AND
                (exclude_cpt_codes IS null OR NOT exclude_cpt_codes = (context.cpt_code_ids && cteAutoBillingRules.cpt_code_ids))
                AND
                (exclude_insurance_provider_payer_types IS null OR NOT exclude_insurance_provider_payer_types = (context.insurance_provider_payer_type_id = ANY(insurance_provider_payer_type_ids)))
                AND
                (exclude_insurance_providers IS null OR NOT exclude_insurance_providers =(context.insurance_provider_id = ANY(insurance_provider_ids)))

            ORDER BY
            id
            LIMIT 1
        `;

        const {
            rows,
        } = await query(sql);

        if (rows.length) {
            const [ row ] = rows;
            const baseParams = {
                companyId: COMPANY_ID,
                patient_id: patientId,
                userId: RADMIN_USER_ID,
                claim_dt: row.study_dt,
                order_ids: [orderId],
                from: 'claimCreation',
                study_ids: studyId,
                claim_status_id: row.claim_status_id,
                order_id: orderId,
                study_id: studyId
            };

            const saveClaimParams = await getSaveClaimParams(baseParams);

            let claim = saveClaimParams?.claims?.[0];

            if (claim.billing_type === 'census') {
                logger.logInfo('Auto Billing: Claims will not be created for studies having ordering facility location with billing type as Census.');
            }
            else {
                saveClaimParams.claims = await claimController.splitClaim(claim, claim.claim_charges, saveClaimParams.insurances, config.get('enableMobileBilling'));

                await claimsData.save(saveClaimParams);
            }            
        }

        return rows;
    },
};
