const { query, SQL } = require('./../index');

module.exports = {

    getEraFiles: async function (params) {
        const sql = `        
            SELECT
                id,
                id AS file_name,
                file_store_id,
                created_dt AS updated_date_time,
                status AS current_status,
                file_type,
                file_path,
                file_size AS size,
                file_md5
            FROM
                billing.edi_files
            WHERE
                status = 'pending' AND
                company_id =  ${params.customArgs.companyID};
        `;
        return await query(sql);
    },

    selectInsuranceEOB: async function (params) {

        const paymentSQL = `
                        SELECT
                            id
                          , insurance_code
                          , insurance_name
                          , insurance_info 
                        FROM 
                            insurance_providers 
                        WHERE 
                            has_deleted = false AND 
                            company_id = ${params.company_id} AND 
                            insurance_info->'PayerID' = ${params.payer_id}::text `;

        return await query(paymentSQL);
    },

    createEdiPayment: async function(params){

        const sql = `INSERT INTO billing.edi_file_payments
                                            (   edi_file_id
                                              , payment_id
                                            )
                                            (SELECT
                                                ${params.file_id}
                                              , ${params.id}
                                            )
                                            RETURNING id`;
        return await query(sql);
    },

    createPaymentApplication: async function(params, paymentDetails){

        let {
            lineItems
            , ediFileClaims
            , claimComments
        } = params;

        const sql =SQL` WITH application_details AS (
                             SELECT 
                                  *
                             FROM json_to_recordset(${JSON.stringify(lineItems)}) AS (
                                 claim_number bigint
                                ,claim_status_code bigint
                                ,claim_frequency_code bigint
                                ,this_pay money
                                ,this_adj money
	                            ,cpt_code text
	                            ,cas_obj jsonb
                             )
                            ),
                           selected_Items AS (
                                SELECT 
                                    application_details.*
                                    , ch.id as charge_id
                                FROM 
                                application_details  
                                INNER JOIN billing.claims c on c.id = application_details.claim_number
                                INNER JOIN LATERAL (
                                    SELECT 
                                       ch.id
                                    FROM 
                                        billing.charges ch	
                                   INNER JOIN cpt_codes on cpt_codes.id = ch.cpt_id AND cpt_codes.display_code = application_details.cpt_code 
                                   WHERE 
                                    ch.claim_id = c.id 
                                    AND NOT cpt_codes.has_deleted 
                                    AND cpt_codes.is_active 
                                    ORDER BY id ASC LIMIT 1
                                ) AS charges ON true
                           ), 
                           insert_payment AS (
                                  INSERT INTO billing.payment_applications
                                  ( payment_id
                                  , charge_id
                                  , amount
                                  , amount_type
                                  , created_by
                                  , applied_dt )
                                  (
                                    SELECT
                                    ${paymentDetails.id}
                                  , charge_id
                                  , this_pay
                                  , 'payment'
                                  , ${paymentDetails.created_by}
                                  , now()
                                  FROM selected_Items )
                                  RETURNING id AS application_id, charge_id , amount_type
                            ),
                            insert_adjustment AS (
                                  INSERT INTO billing.payment_applications
                                  ( payment_id
                                  , charge_id
                                  , amount
                                  , amount_type
                                  , created_by
                                  , applied_dt )
                                  (
                                    SELECT
                                    ${paymentDetails.id}
                                  , charge_id
                                  , this_adj
                                  , 'adjustment'
                                  , ${paymentDetails.created_by}
                                  , now()
                                  FROM selected_Items )
                                  RETURNING id AS application_id, charge_id , amount_type 
                            ),
                            insert_edi_file_claims AS (
                                INSERT INTO billing.edi_file_claims
                                (
                                    claim_id
                                    ,edi_file_id
                                )
                                SELECT 
                                    claim_number 
                                    ,edi_file_id
                                FROM 
                                    json_to_recordset(${JSON.stringify(ediFileClaims)}) AS edi_claims
                                    (
                                        claim_number bigint
                                        ,edi_file_id bigint
                                    )
                                INNER JOIN billing.claims c on c.id = edi_claims.claim_number
                                RETURNING claim_id, edi_file_id
                                ),
                            insert_claim_comments AS (
                                INSERT INTO billing.claim_comments
                                (
                                    claim_id
                                    ,note
                                    ,type
                                    ,created_by
                                    ,created_dt
                                )
                                SELECT 
                                    claim_number 
                                    ,note
                                    ,type
                                    ,${paymentDetails.created_by}
                                    ,'now()'
                                FROM 
                                    json_to_recordset(${JSON.stringify(claimComments)}) AS claim_notes
                                    (
                                        claim_number bigint
                                        ,note text
                                        ,type text
                                    )
                                INNER JOIN billing.claims c on c.id = claim_notes.claim_number
                                RETURNING id AS claim_comment_id
                                )
                            SELECT
	                            ( SELECT json_agg(row_to_json(insert_adjustment)) insert_adjustment
                                            FROM (
                                                    SELECT
                                                          *
                                                    FROM
                                                    insert_adjustment
                                            
                                                ) AS insert_adjustment
                                     ) AS insert_adjustment,
	                            ( SELECT json_agg(row_to_json(insert_edi_file_claims)) insert_edi_file_claims
                                            FROM (
                                                    SELECT
                                                        claim_id as claim_number
                                                        ,edi_file_id
                                                        ,true AS applied
                                                    FROM
                                                    insert_edi_file_claims
                                            
                                                ) AS insert_edi_file_claims
                                     ) AS insert_edi_file_claims
                            `;
        
        return await query(sql);
    },

    checkERAFileIsProcessed: async function (file_md5, company_id) {
        const sql = `
        
            WITH upload_info AS
                (
                    SELECT Json_agg(file_exists) file_exists
                    FROM   (
                        SELECT
                            EXISTS(
                                SELECT 1
                                    FROM
                                        billing.edi_files
                                    WHERE
                                file_md5 = '${file_md5}'
                            )
                        AS file_exists
                )
                    AS file_exists ),
            file_store_info AS(
                SELECT Json_agg(Row_to_json(file_store_info)) file_store_info
                    FROM(
                        Select  
                            root_directory
                        FROM 
                            file_stores
                            LEFT JOIN companies ON companies.file_store_id = file_stores.id
                        WHERE
                            companies.id = ${company_id}
                        )
                    AS file_store_info)
            SELECT *
                FROM
                    upload_info,
                    file_store_info   
        `;
        
        return await query(sql); 
    },

    saveERAFile: async function (params) {
        const sql = `        
            INSERT INTO   
                billing.edi_files        
                    (company_id,
                     file_store_id,
                     created_dt,
                     status,
                     file_type,
                     file_path,
                     file_size,
                     file_md5)
                     (
                        SELECT
                           ${params.company_id}
                         ,${params.file_store_id}
                         ,now()
                         ,'${params.status}'
                         ,'${params.file_type}'
                         ,'${params.file_path}'
                         ,${params.file_size}
                         ,'${params.file_md5}'
                        )
                        RETURNING id
        `;
        
        return await query(sql); 
    },

    getFileStorePath: async function (params) {
        const sql = `          
                Select 
                    root_directory 
                FROM file_stores 
                    LEFT JOIN companies ON companies.file_store_id = file_stores.id
                WHERE companies.id = ${params.company_id} 
        `;
        
        return await query(sql); 
    },

    getcasReasonGroupCode: async function(params){

        let { company_id } = params;

        const sql = ` WITH cas_group as 
                        ( SELECT
                            array_agg(code) as cas_groups
                        FROM
                            billing.cas_group_codes
                        WHERE inactivated_dt IS NULL AND company_id =  ${company_id}
                        ) ,
                        cas_reason as
                        ( SELECT
                            array_agg(code) as cas_reasons
                        FROM
                            billing.cas_reason_codes
                        WHERE inactivated_dt IS NULL AND  company_id =  ${company_id}
                        )
                    SELECT * FROM cas_group,cas_reason `;

        return await query(sql);
    },

    getERAFilePathById: async function (params) {
        let {
            file_id,
            company_id
        } = params;

        const sql = `          
                Select 
                    ef.id
				    ,ef.status
				    ,ef.file_type
				    ,ef.file_path 
				    ,fs.root_directory
                FROM 
                    billing.edi_files ef
                INNER JOIN file_stores fs on fs.id = ef.file_store_id
                WHERE ef.id = ${file_id} AND ef.company_id = ${company_id}
        `;
        
        return await query(sql); 
    }
};