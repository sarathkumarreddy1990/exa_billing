const {
    SQL,
    query,
    queryWithAudit
} = require('../index');
const moment = require('moment');

const claimsData = require('../../data/claim/index');

const logger = require('../../../logger');


const debugCallAndQuery = (params, sql) => {
    logger.info('USING PARAMS: ', params);
    // logger.info('QUERY TEXT: ', sql.text)
    // logger.info('QUERY VALUES: ', sql.values)
    // logger.info('QUERY SQL: ', sql.sql)
};

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
const DEFAILT_PAYER_TYPE = "primary_insurance"
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
}

const getPointer = (problem) => {
    return (problem && problem.order_no) || null;
};

const getSaveClaimParams = async (params) => {

    const {
        patient_id,
        companyId,
        userId,
    } = params;

    const patientInsurances = (await claimsData.getPatientInsurances(params)).rows;
    const lineItems = (await claimsData.getLineItemsDetails(params)).rows;

    const primary_insurance = patientInsurances[0].existing_insurance.find((insurance) => {return insurance.coverage_level === 'primary'});

    const settings = await getSettings();

    const isCanadaBilling = settings.country_alpha_3_code === 'can';

    const problems = lineItems[0].problems;
    const claim_details = lineItems[0].claim_details[0];

    return {
        removed_charges: [],

        is_alberta_billing: isCanadaBilling && settings.province_alpha_2_code === 'AB',

        claims: {
            company_id: companyId,
            billing_class_id: DEFAULT_BILLING_CLASS_ID,
            billing_code_id: DEFAULT_BILLING_CODE_ID,
            billing_method: primary_insurance.billing_method,
            billing_notes: DEFAULT_BILLING_NOTES,
            billing_provider_id: settings.default_provider_id,
            claim_dt: moment(),
            claim_notes: DEFAULT_CLAIM_NOTES,
            claim_status_id: params.claim_status_id,
            created_by: userId,
            // ordering_facility_id: lineItems[0].claim_details[0].
            patient_id,
            payer_type: DEFAILT_PAYER_TYPE,
            place_of_service_id: isCanadaBilling ? null : claim_details.fac_place_of_service_id,

            ...claim_details,
            accident_state: claim_details.accident_state || null,
        },

        insurances: patientInsurances[0].existing_insurance.map((insurance) => {
            insurance.claim_patient_insurance_id = insurance.id;
            insurance.is_update_patient_info = false;
            insurance.patient_id = patient_id;
            return insurance;
        }),

        charges: lineItems[0].charges.map((charge) => {
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
            return charge;
        }),

        claim_icds: problems.map((problem) => {
            return {
                id: null,
                icd_id: problem.id,
                claim_id: null,
                is_deleted: PROBLEM_IS_DELETED,
            }
        }),

        auditDetails: {
            company_id: companyId,
            screen_name: 'system-event',
            module_name: 'claims',
            client_ip: CLIENT_IP,
            user_id: userId
        },
    };
    //
    // , allowed_amount money
    // , authorization_no text
    // , bill_fee money
    // , cpt_id bigint
    // , created_by bigint             // ?
    // , charge_dt timestamptz         // use study_dt
    // , is_excluded boolean           // ?
    // , is_canada_billing boolean     // ?
    // , modifier1_id bigint           // use m1
    // , modifier2_id bigint           // use m2
    // , modifier3_id bigint           // use m3
    // , modifier4_id bigint           // use m4
    // , pointer1 text                 // ?
    // , pointer2 text                 // ?
    // , pointer3 text                 // ?
    // , pointer4 text                 // ?
    // , study_id bigint
    // , units numeric
};

const getClaimDetails = async () => {

    return {
        company_id: COMPANY_ID,


    }
    // accident_state
    // authorization_no
    // current_illness_date
    // facility_id,
    // frequency
    // hospitalization_from_date
    // hospitalization_to_date
    // is_auto_accident
    // is_employed
    // is_other_accident
    // original_reference
    // service_by_outside_lab
    // rendering_provider_contact_id
    // referring_provider_contact_id`
    // same_illness_first_date
    // unable_to_work_from_date
    // unable_to_work_to_date
    //
    // billing_class_id         // DEFAULT_BILLING_CLASS_ID
    // billing_code_id          // DEFAULT_BILLING_CODE_ID
    // billing_notes            // DEFAULT_BILLING_NOTES
    // claim_notes              // DEFAULT_CLAIM_NOTES
    // created_by               // RADMIN_USER_ID
    // payer_type               // ???  "primary_insurance"
    // billing_provider_id,     // settings.default_provider_id
    // claim_status_id          // ???  GET THIS FROM THE RULE
    // claim_dt                 // ???
    // patient_id,              // ???
    // ordering_facility_id     // get this from line items

    // billing_method           // ???
    // place_of_service_id      // ??? okay to be null (fac_place_of_service_id)
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
                AND cabr.description ILIKE ${term}
            `);
        }

        if (study_status) { //} && study_status !== WILDCARD_ID) {
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
                , cs.description                AS claim_status_description
                , cabr.is_active
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

        SELECT
            abr.id
            , description
            , claim_status_id
            , inactivated_dt
            , array_agg(study_status_code) as study_status_codes
            , abr_study_status.excludes as exclude_study_statuses
            , array_agg(DISTINCT facility_id) as facility_ids
            , abr_facilities.excludes as exclude_facilities
        FROM
            billing.autobilling_rules abr
            LEFT JOIN billing.autobilling_study_status_rules abr_study_status ON abr_study_status.autobilling_rule_id = abr.id
            LEFT JOIN billing.autobilling_facility_rules abr_facilities ON abr_facilities.autobilling_rule_id = abr.id
        WHERE
            abr.id = ${id}
        GROUP BY
            abr.id
            , abr_study_status.excludes
            , abr_facilities.excludes
        `;
        return await query(sql);
    },

    createAutobillingRule: async (params) => {

        const {
            description,
            claim_status_id,
            inactive,
            userId,

            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

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
                RETURNING id
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
            SELECT id FROM abrInsert
        `;
        return await query(sql);
    },

    updateAutobillingRule: async (params) => {
        const {
            id,
            description,
            claim_status_id,
            study_status,
            inactive,

            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

        } = params;


        const sql = SQL`
            WITH
                facilitiesCleanSlate AS (
                    DELETE FROM billing.autobilling_facility_rules WHERE autobilling_rule_id = ${id}
                )
                , studyStatusesCleanSlate AS (
                    DELETE FROM billing.autobilling_study_status_rules WHERE autobilling_rule_id = ${id}
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
                )

            UPDATE billing.autobilling_rules
            SET
                description = ${description}
                , claim_status_id = ${claim_status_id}
                , inactivated_dt = ${inactive ? "now()": null}
            WHERE
                id = ${id}
            RETURNING ${id}
        `;

        return await query(sql);

    },

    deleteAutobillingRule: async (params) => {
        const {
            id,
        } = params;

        const sql = SQL`
            UPDATE billing.autobilling_rules
            SET
                deleted_dt = now()
            WHERE
                id = ${id}
            RETURNING id
        `;
        return await query(sql);
    },

    executeAutobillingRules: async (params) => {
        const {
            studyId,
            studyStatus,
            patientId,
            orderId,
            // params.session.country_alpha_3_code
        } = params;
        console.log(params);

        const sql = SQL`
        WITH cteAutoBillingRules AS (
            SELECT
                abr.id
                , claim_status_id
                , abssr.excludes as exclude_study_status
                , array_agg(facility_id) as facility_ids
                , abfr.excludes as exclude_facilities
            FROM
                billing.autobilling_rules abr
                LEFT JOIN billing.autobilling_study_status_rules abssr ON abssr.autobilling_rule_id = abr.id
                LEFT JOIN billing.autobilling_facility_rules abfr ON abfr.autobilling_rule_id = abr.id

            WHERE
                study_status_code = ${studyStatus}
            GROUP BY
                abr.id
                , abssr.excludes
                , abfr.excludes
        )
        SELECT
            *
        FROM
            cteAutoBillingRules
        WHERE
            (exclude_facilities IS null OR NOT exclude_facilities = (1 = ANY(facility_ids)))
        ORDER BY
            id
        LIMIT 1

        `;

        const {
            rows,
        } = await query(sql);

        if (rows.length) {
            const baseParams = {
                companyId: COMPANY_ID,
                patient_id: patientId,
                userId: RADMIN_USER_ID,
                claim_date: 'now()',
                order_ids: [orderId],
                from: 'claimCreation',
                study_ids: studyId,
                claim_status_id: rows[0].claim_status_id,
            }


            const saveClaimParams = await getSaveClaimParams(baseParams);
            // console.log('SAVE CLAIM PARAMS: ', saveClaimParams);
            const results = await claimsData.save(saveClaimParams);
            // console.log('SAVE CLAIM RESULTS: ', results);
        }

        return rows;
    },


};
