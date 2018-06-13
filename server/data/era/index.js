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
        } = params;

        const sql =SQL` WITH application_details AS (
                             SELECT 
                                  *
                             FROM json_to_recordset(${JSON.stringify(lineItems)}) AS (
                                 claim_number bigint
                                ,claim_date date
                                ,claim_status_code bigint
                                ,total_paid_amount money 
                                ,total_billfee money 
                                ,claim_frequency_code bigint
                                ,bill_fee money
                                ,this_pay money
                                ,this_adj money
	                            ,units numeric(7,3)
	                            ,cpt_code text
	                            ,modifier1 text
	                            ,modifier2 text
	                            ,modifier3 text
	                            ,modifier4 text
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
                                INNER JOIN billing.charges ch on ch.claim_id = c.id
                                INNER JOIN cpt_codes on cpt_codes.id = ch.cpt_id AND application_details.cpt_code = cpt_codes.display_code
                                WHERE NOT cpt_codes.has_deleted AND cpt_codes.is_active
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
                                )
                            SELECT * FROM insert_adjustment `;
        
        return await query(sql);
    },

    checkERAFileIsProcessed: async function (file_md5) {
        const sql = `        
        SELECT           
            EXISTS(
                    SELECT 1
                FROM
                    billing.edi_files
                WHERE
                    file_md5 = '${file_md5}')
                    AS file_exists ;
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
    }
};