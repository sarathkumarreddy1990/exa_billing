const { queryRows, SQL } = require('./index');

module.exports = {

    read: async function (siteID) {
        let sql = SQL`
            SELECT COALESCE(web_config, '[]'::json) AS web_config 
            FROM sites
            WHERE id = ${siteID}
        `;

        return await queryRows(sql);
    }
};
