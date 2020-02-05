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
                            WHERE cc.display_code != 'I0001' AND bc.claim_id = ANY(${claimIds}) 
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
                        LEFT JOIN public.get_issuer_details(p.id, 'phn') phn ON true
                        LEFT JOIN claim_icds ci on ci.id = c.id
                        LEFT JOIN charges ch ON ch.id = c.id
                        LEFT JOIN public.provider_groups pg ON pg.id = c.ordering_facility_id
                        LEFT JOIN public.places_of_service pos ON pos.id = COALESCE(f.place_of_service_id, pg.place_of_service_id)
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

        return queryRows(fileSql);

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
                            CONCAT(file_path, '/', uploaded_file_name) AS file_path
                        FROM billing.edi_files 
                        WHERE id = ${fileStoreId}`;

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
                        
        return query(sql.text, sql.values);
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
        return query(sql.text, sql.values);
    }
};

module.exports = mhsData;
