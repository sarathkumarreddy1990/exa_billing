const { query } = require('./../index');

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