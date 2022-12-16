'use strict';
const { query, queryRows, SQL } = require('../index');

const mhsData = {

    /*
    * submitClaim - Claim submission
    * @param {Object} args
    * @returns {Object}
    */
    submitClaim: async (args) => {
        let {
            claimIds
        } = args;

        const sql = SQL`
                        WITH charges AS(
                            SELECT
                                c.id
                                , SUM((bc.units * bc.bill_fee))::NUMERIC AS claim_total_bill_fee
                                , json_agg(json_build_object(
                                    'code', cc.display_code
                                    , 'bill_fee', (bc.units * bc.bill_fee)::NUMERIC
                                    , 'units', bc.units
                                    , 'service_start_dt', to_char( bc.charge_dt, 'YYMMDD')
                                    , 'modifers', modifiers
                                    , 'pointer1', bc.pointer1
                                )) AS health_services
                            FROM billing.claims c
                            INNER JOIN billing.charges bc ON bc.claim_id = c.id
                            INNER JOIN public.cpt_codes cc ON cc.id = bc.cpt_id
                            LEFT JOIN LATERAL  (
                                SELECT ARRAY(SELECT code FROM modifiers WHERE id IN (bc.modifier1_id, bc.modifier2_id, bc.modifier3_id, bc.modifier4_id)) AS modifier_ids
                            ) modifiers  ON TRUE
                            WHERE cc.display_code != 'I001' AND NOT is_excluded AND bc.claim_id = ANY(${claimIds})
                            GROUP BY c.id
                        ),
                        claim_icds AS (
                            SELECT
                                c.id
                                , array_agg(icd.code) AS icds
                            FROM
                                billing.claims c
                            INNER JOIN billing.claim_icds ci  ON ci.claim_id =  c.id
                            INNER JOIN public.icd_codes icd ON icd.id = ci.icd_id
                            WHERE c.id = ANY(${claimIds})
                            GROUP BY c.id
                        )
                        SELECT
                            c.id                                                                        AS claim_number
                            , f.can_facility_number                                                     AS facility_number
                            , c.claim_notes                                                             AS remarks
                            , c.rendering_provider_contact_id                                           AS interpreting_radiologist_number
                            , c.referring_provider_contact_id
                            , c.patient_id
                            , c.can_wcb_rejected
                            , c.can_confidential
                            , ch.health_services
                            , ch.claim_total_bill_fee
                            , ci.icds
                            , f.can_facility_number                                                     AS facility_number
                            , pos.name                                                                  AS can_location_service
                            , c.claim_notes AS remarks
                            , c.patient_id
                            , c.can_wcb_rejected
                            , c.can_confidential
                            , c.area_of_injury_code_id
                            , c.nature_of_injury_code_id
                            , JSON_BUILD_OBJECT(
                                'phn_details', phn.*
                                , 'last_name', p.last_name
                                , 'registration_number_details', res.*
                                , 'patient_id', p.id
                                , 'sur_name', prefix_name
                                , 'first_name', p.first_name
                                , 'account_number', account_no
                                , 'gender', gender
                                , 'birth_date', to_char(birth_date, 'YYYYMMDD')
                                , 'century', to_char(birth_date, 'CC')
                                , 'address1',patient_info->'c1AddressLine1'
                                , 'address2',patient_info->'c1AddressLine2'
                                , 'city', patient_info->'c1City'
                                , 'postal_code', patient_info->'c1Zip'
                                , 'province_code', patient_info->'c1State'
                            ) AS service_reception_details
                            , JSON_BUILD_OBJECT(
                                'prid',prac.can_prid
                                , 'full_name', prac_pro.full_name
                                , 'country', prac.contact_info->'COUNTRY'
                                , 'state', prac.contact_info->'STATE'
                                , 'city' , prac.contact_info->'CITY'
                            ) AS practitioner
                            , JSON_BUILD_OBJECT(
                                'prid', ren.can_prid
                                , 'full_name', ren_pro.full_name
                                , 'country', ren.contact_info->'COUNTRY'
                                , 'state', ren.contact_info->'STATE'
                                , 'city' , ren.contact_info->'CITY'
                            ) AS interpreting_provider
                            , JSON_BUILD_OBJECT(
                                'prid',refp.can_prid
                                , 'full_name', refp_pro.full_name
                                , 'country', refp.contact_info->'COUNTRY'
                                , 'state', refp.contact_info->'STATE'
                                , 'city' , refp.contact_info->'CITY'
                            ) AS referring_provider
                            , CASE
                                WHEN phn->>'province_alpha_2_code' = 'MB'
                                THEN  res->>'prid'
                                ELSE '0000'
                              END  AS register_number
                            , CASE
                                WHEN refp.can_prid IS NOT NULL AND refp.contact_info->'STATE' != 'MB'
                                THEN JSON_BUILD_OBJECT(
                                        'prid', '04000',
                                        'remarks', CONCAT(refp_pro.full_name ,' ', refp.contact_info->'STATE',' ', refp.contact_info->'CITY')
                                    )
                                WHEN refp.can_prid IS NULL AND refp.contact_info->'STATE' = 'MB'
                                THEN JSON_BUILD_OBJECT(
                                        'prid', '04500',
                                        'remarks', refp_pro.full_name
                                    )
                                ELSE
                                JSON_BUILD_OBJECT(
                                    'remarks', refp_pro.full_name
                                )
                              END AS referring_provider_remarks
                        FROM
                        billing.claims c
                        INNER JOIN public.facilities f ON f.id = c.facility_id
                        LEFT JOIN public.provider_contacts prac ON prac.id = f.can_mb_medical_director_provider_id
                        LEFT JOIN public.providers prac_pro ON prac_pro.id = prac.provider_id
                        LEFT JOIN public.provider_contacts ren ON ren.id = c.rendering_provider_contact_id
                        LEFT JOIN public.providers ren_pro ON ren_pro.id = ren.provider_id
                        LEFT JOIN public.provider_contacts refp ON refp.id = c.referring_provider_contact_id
                        LEFT JOIN public.providers refp_pro ON refp_pro.id = refp.provider_id
                        INNER JOIN public.patients p  ON  p.id = c.patient_id
                        LEFT JOIN public.get_issuer_details(p.id, 'registration_number') res ON TRUE
                        LEFT JOIN public.get_issuer_details(p.id, 'uli_phn') phn ON true
                        LEFT JOIN claim_icds ci on ci.id = c.id
                        LEFT JOIN charges ch ON ch.id = c.id
                        LEFT JOIN public.ordering_facility_contacts pofc ON pofc.id = c.ordering_facility_contact_id
                        LEFT JOIN public.ordering_facilities pof ON pof.id = pofc.ordering_facility_id
                        LEFT JOIN public.places_of_service pos ON pos.id = COALESCE(f.place_of_service_id, pofc.place_of_service_id)
                        WHERE c.id = ANY(${claimIds});`;

        return await queryRows(sql);
    },

    /**
    * getCompanyFileStore - get company and file store deatials
    * @param {BigInteger} company_id
    * @returns {Object}
    */
    getCompanyFileStore: async (company_id) => {
        const fileSql = SQL`
                            SELECT
                                fs.id AS file_store_id
                                , fs.root_directory
                                , c.can_submitter_prefix
                                , company_name
                            FROM file_stores fs
                            INNER JOIN companies c ON c.file_store_id = fs.id
                            WHERE c.id = ${company_id}`;

        return await queryRows(fileSql);

    },

    /**
    * storeFile - capturing data encoded file
    * @param {Object} info
    * @returns {Object}
    */
    storeFile: async info => {
        const {
            file_name,
            file_store_id,
            companyId,
            file_path,
            file_md5,
            file_size,
        } = info;

        const sql = SQL`
                        INSERT INTO billing.edi_files (
                            company_id
                            , file_store_id
                            , created_dt
                            , status
                            , file_path
                            , file_size
                            , file_md5
                            , file_type
                            , uploaded_file_name
                        )
                        SELECT
                            ${companyId}
                            , ${file_store_id}
                            , now()
                            , 'pending'
                            , ${file_path}
                            , ${file_size}
                            , ${file_md5}
                            , 837::INT
                            , ${file_name}
                        RETURNING
                            id`;

        return (await queryRows(sql)).pop().id;

    },

    /**
    * getFilePath - get file path
    * @param {BigInteger} fileStoreId
    * @returns {Object}
    */
    getFilePath: async (fileStoreId) => {
        const sql = SQL`
                        SELECT
                            (f.root_directory || '/' || ef.file_path || '/' || ef.uploaded_file_name) AS file_path
                        FROM billing.edi_files ef
                        INNER JOIN public.file_stores f ON f.id = ef.file_store_id
                        WHERE ef.id = ${fileStoreId}`;

        return (await queryRows(sql)).pop();
    },

    /**
    * ediFiles - capturing data of edi file
    * @param {Object} args
    * @returns {Object}
    */
    ediFiles: async (args) => {
        let {
            ediFileId,
            claimIds
        } = args;

        const sql = SQL`
                INSERT INTO billing.edi_file_claims (
                    edi_file_id
                    , claim_id
                )
                SELECT
                    ${ediFileId},
                    UNNEST(${claimIds}::INT[])`;

        return await query(sql.text, sql.values);
    },

    /**
     * Payment applying for the the details from payment file
     * @param {object} args    {
     *                             file_id: Number,
     *                             facility_id: Number,
     *                             fileData: Object, // MHSAL payments json object
     *                             userId: Number
     *                         }
     * @returns {object}       {
     *                             response: boolean
     *                         }
     */
    applyPayments: async (fileData, args) => {
        let {
            file_id,
            company_id,
            userId,
            facility_id,
            clientIp
        } = args;
        let auditDetails = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp,
            'user_id': userId
        };

        const sql = SQL`SELECT billing.can_mhs_apply_payments(
                            ${facility_id}
                          , ${file_id}::BIGINT
                          , ${JSON.stringify(fileData)}::JSONB
                          , ${JSON.stringify(auditDetails)}::JSONB
                        ) AS applied_payments`;

        return await query(sql);
    },

    /**
     *  Get Files list from edi_files table based on status
     * @param {args} JSON
     */
    getERAFilePathById: async function (params) {
        let {
            file_id,
            company_id
        } = params;

        const sql = `SELECT
                         ef.id
                       , ef.status
                       , ef.file_type
                       , ef.file_path
                       , fs.root_directory
                       , ef.uploaded_file_name
                     FROM billing.edi_files ef
                     INNER JOIN file_stores fs on fs.id = ef.file_store_id
                     WHERE ef.id = ${file_id} AND ef.company_id = ${company_id}`;

        return await query(sql);
    },

    /**
     * Update File status
     * @param  {object} args    {
     *                             FileId: Number
     *                          }
     */
    updateFileStatus: async (args) => {
        let {
            fileId,
            status
        } = args;

        const sql = SQL`UPDATE
                            billing.edi_files
                        SET status = ${status}
                        WHERE id = ${fileId}`;

        return await query(sql);
    },

    /**
     * Create Chargess For Interest payments
     * @param {Object} args {
     *                      file_id: Number,
     *                      facility_id: Number,
     *                      InterestData: Object, // MHSAL processed payments json object
     *                      userId: Number
     *                      }
     * @returns {object}    {
     *                          response: Json
     *                      }
     */
    createInterestCharges: async (interestData, args) => {
        const {
            company_id,
            userId,
            facility_id,
            clientIp
        } = args;
        const auditDetails = {
            'company_id': company_id,
            'screen_name': 'claims',
            'module_name': 'claims',
            'client_ip': clientIp,
            'user_id': userId
        };
        const {
            services
        } = interestData;

        const sql = SQL`SELECT billing.can_mhs_create_interest_charge(
                            ${facility_id}
                          , ${JSON.stringify(services)}::JSONB
                          , ${JSON.stringify(auditDetails)}::JSONB
                        )`;

        return await query(sql);
    },

    unappliedChargePayments: async (params) => {
        let {
            file_id,
            company_id,
            clientIp,
            userId
        } = params;
        const audit_details = {
            'company_id': company_id,
            'screen_name': 'payments',
            'module_name': 'payments',
            'client_ip': clientIp,
            'user_id': userId
        };

        const sql = SQL`
                    WITH claim_payment AS (
                        SELECT
                              ch.claim_id
                            , efp.payment_id
                            , pa.applied_dt
                        FROM billing.charges AS ch
                        INNER JOIN billing.payment_applications AS pa ON pa.charge_id = ch.id
                        INNER JOIN billing.payments AS p ON pa.payment_id  = p.id
                        INNER JOIN billing.edi_file_payments AS efp ON pa.payment_id = efp.payment_id
                        WHERE efp.edi_file_id = ${file_id }  AND mode = 'eft'
                        GROUP BY ch.claim_id, efp.payment_id, pa.applied_dt
                        ORDER BY pa.applied_dt DESC
                    )
                    , unapplied_charges AS (
                        SELECT
                              cp.payment_id
                            , json_build_object(
                                  'charge_id', ch.id
                                , 'payment', 0
                                , 'adjustment', 0
                                , 'cas_details', '[]'::jsonb
                                , 'applied_dt', cp.applied_dt
                            )
                        FROM billing.charges ch
                        INNER JOIN billing.claims AS c ON ch.claim_id = c.id
                        INNER JOIN claim_payment AS cp ON cp.claim_id = c.id
                        WHERE ch.id NOT IN ( SELECT charge_id
                                             FROM  billing.payment_applications pa
                                             WHERE pa.charge_id = ch.id
                                             AND pa.payment_id = cp.payment_id
                                             AND pa.applied_dt = cp.applied_dt
                                           )
                    )
                    , insert_payment_adjustment AS (
                        SELECT
                            billing.create_payment_applications(
                                  uc.payment_id
                                , null
                                , ${userId }
                                , json_build_array(uc.json_build_object)::jsonb
                                , (${audit_details })::jsonb
                            )
                        FROM unapplied_charges uc
                    )
                    SELECT * FROM insert_payment_adjustment `;

        return await query(sql);
    },

    /**
    * updateClaimsStatus - updating claim status
    * @param {Object} args
    * @returns {Object}
    */
    updateClaimsStatus: async (args) => {
        const {
            claimIds,
            statusCode,
            claimNote,
            userId
        } = args;

        const sql = SQL`
                WITH status AS (
                    SELECT
                        id
                    FROM
                        billing.claim_status
                    WHERE
                        code = ${statusCode}
                    LIMIT 1
                )
                , addClaimComment AS (
                    INSERT INTO billing.claim_comments (
                          note
                        , type
                        , claim_id
                        , created_by
                        , created_dt
                    )
                    VALUES (
                          ${claimNote}
                        , 'auto'
                        , UNNEST(${claimIds}::INT[])
                        , ${userId}
                        , now()
                    ) RETURNING *
                )
                UPDATE
                    billing.claims
                SET
                    claim_status_id = status.id
                FROM
                    status
                WHERE
                    billing.claims.id = ANY(${claimIds}:: BIGINT[])
                RETURNING
                    billing.claims.*
            `;
        return await query(sql.text, sql.values);
    },

    getClaimsData: async (args) => {
        const {
            claimIds
        } = args;

        const sql = SQL`
            SELECT
                bc.id AS claim_id
                , bc.billing_method
                , phn.*
                , register_number.*
                , ppcrd.can_prid as rendering_provider_number
                , ppcrf.can_prid as referring_provider_number
                , patient_name
                , pp.first_name as patient_first_name
                , pp.last_name as patient_last_name
                , pp.gender as patient_gender
                , pp.patient_info -> 'c1AddressLine1' AS patient_address_line_1
                , COALESCE(NULLIF(pp.patient_info -> 'c1AddressLine2', ''), NULLIF(pp.patient_info -> 'c1Zip', '')) AS patient_postal_code
                , pp.patient_info -> 'c1City' AS patient_city
                , pp.patient_info -> 'c1State' AS patient_province
                , pp.patient_info -> 'c1country' AS patient_country
                , NULLIF(bgct.charges_bill_fee_total , 0::money) AS claim_total_charge
                , ppc.can_prid AS practioner_number
                , COALESCE(bch.icds, true) AS icds
                , pip.insurance_name AS payer_name
                , bc.claim_notes AS claim_notes
                , pf.can_facility_number AS facility_number
                , bcs.code AS claim_status_code
            FROM billing.claims bc
            INNER JOIN billing.claim_status bcs ON bcs.id = bc.claim_status_id
            INNER JOIN public.patients pp ON pp.id = bc.patient_id
            INNER JOIN get_full_name(pp.last_name, pp.first_name) patient_name ON TRUE
            INNER JOIN public.get_issuer_details(pp.id, 'uli_phn') phn ON TRUE
            INNER JOIN public.get_issuer_details(pp.id, 'registration_number') register_number ON TRUE
            INNER JOIN billing.get_claim_totals(bc.id) bgct ON TRUE
            LEFT JOIN public.provider_contacts ppcrd ON ppcrd.id = bc.rendering_provider_contact_id
            LEFT JOIN public.provider_contacts ppcrf ON ppcrf.id = bc.referring_provider_contact_id
            LEFT JOIN (SELECT
                            COUNT(claim_id) = COUNT(claim_id) FILTER (WHERE pointer1 IS NOT NULL) AS icds
                            , claim_id
                       FROM billing.charges bic
                       INNER JOIN public.cpt_codes pcc ON bic.cpt_id = pcc.id
                       WHERE bic.is_excluded = false and pcc.display_code != 'I001'
                       GROUP BY claim_id
                      ) bch ON bch.claim_id = bc.id
            INNER JOIN public.facilities pf ON bc.facility_id = pf.id
            LEFT JOIN public.provider_contacts ppc ON ppc.id = pf.can_mb_medical_director_provider_id
            LEFT JOIN billing.claim_patient_insurances cpi ON cpi.claim_id = bc.id AND cpi.coverage_level = 'primary'
            LEFT JOIN public.patient_insurances ppi ON ppi.id = cpi.patient_insurance_id
            LEFT JOIN public.insurance_providers pip ON pip.id = ppi.insurance_provider_id
            WHERE bc.id = ANY(${claimIds})`;

        return await queryRows(sql);
    }
};

module.exports = mhsData;
