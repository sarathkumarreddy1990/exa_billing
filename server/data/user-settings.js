const { query, SQL } = require('./index');

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
                , ${args.flag}
            WHERE NOT EXISTS (
                SELECT * FROM billing.user_settings WHERE user_id = ${args.userId}
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
                ,default_tab = ${args.flag}
            WHERE 
                user_id = ${args.userId}
            RETURNING *
        )
        SELECT id FROM insert_user_setting
        UNION
        SELECT id FROM update_user_setting`;

        return await query(querySetting);
    }
};
