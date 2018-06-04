const { query, SQL } = require('./index');
let path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

module.exports = {

    save: async function (args) {

        let querySetting = SQL`
        WITH insert_user_setting AS
        (
        INSERT INTO billing.user_settings
             (
                 user_id
                 ,field_order
                 ,grid_name
                 ,default_column_order_by
                 ,default_column
                 ,default_tab
                )
            SELECT
                ${args.userId}
                , ${args.claimSettingFields}
                , ${args.flag}
                , ${args.claim_sort_order}
                , ${args.claim_col_name}
                , ${args.default_tab}
            WHERE NOT EXISTS (
                SELECT * FROM billing.user_settings WHERE user_id = ${args.userId} AND grid_name = ${args.flag}
            )
            RETURNING *
        ),
        update_user_setting AS 
        (
            UPDATE 
                billing.user_settings
            SET field_order = ${args.claimSettingFields}
                ,grid_name = ${args.flag}
                ,default_column_order_by = ${args.claim_sort_order}
                ,default_column = ${args.claim_col_name}
                ,default_tab = ${args.default_tab}
            WHERE 
                user_id = ${args.userId}
                AND grid_name = ${args.flag}
            RETURNING *
        )
        SELECT id FROM insert_user_setting
        UNION
        SELECT id FROM update_user_setting`;

        return await query(querySetting); 

    },

    getGridFieldById:async function(params){

        let select_field = ` 
        SELECT
            field_order,grid_name 
        FROM 
           billing.user_settings WHERE user_id = ${params.userID} `;
                
        return await query(select_field);
    },

    getGridFields:async function(){

        let file_path = path.join(__dirname, '../resx/grid-fields.json');
        let gridFields = readFileAsync(file_path, 'utf8');
        
        return await gridFields;
    }
};
