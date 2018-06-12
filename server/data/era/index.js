const { query } = require('./../index');

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

    getLineItems: async function(params){

        console.log(JSON.stringify(params))
    }
};