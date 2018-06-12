const { query, SQL } = require('./../index');

module.exports = {

    getEraFiles: async function (params) {
        const sql = `        
            SELECT
                id,
                id AS file_name,
                file_store_id,
                created_dt AS updated_date_time,
                processed_dt AS updated_date_time,
                status AS current_status,
                file_type ,
                file_path,
                file_size AS size,
                file_md5
            FROM
                billing.edi_files
            WHERE
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

        const sql =SQL` WITH application_details AS (
                             SELECT 
                                  *
                             FROM json_to_recordset(${JSON.stringify(params.lineItems)}) AS (
                                 claim_number bigint
                                ,claim_date date
                                ,claim_status_code bigint
                                ,total_paid_amount money 
                                ,total_billfee money 
                                ,claim_frequency_code bigint
                                ----------line items-------------------
	                            ,bill_fee money
	                            ,this_pay money
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
                                    , 'payment' as amount_type
                                    , ch.id as charge_id
                                FROM 
                                application_details  
                                INNER JOIN billing.claims c on c.id = application_details.claim_number
                                INNER JOIN billing.charges ch on ch.claim_id = c.id
                                INNER JOIN cpt_codes on cpt_codes.id = ch.cpt_id AND application_details.cpt_code = cpt_codes.display_code
                                WHERE NOT cpt_codes.has_deleted AND cpt_codes.is_active
                           ), 
                           insert_application AS (
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
                                  , amount_type
                                  , ${paymentDetails.created_by}
                                  , now()
                                  FROM selected_Items )
                                  RETURNING id AS application_id, charge_id , amount_type )
                            SELECT * FROM insert_application `;

        console.log(sql.text, sql.values)

        return await query(sql);
    }
};