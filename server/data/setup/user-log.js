const { SQL, query } = require('../index');

module.exports = {
    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            username,
            clientIP,
            logged_in_dt,
            logged_out_dt,
            last_access_dt,
            login_source,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (username) {
            whereQuery.push(`COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'') ILIKE '%${username}%' `);
        }

        if (clientIP) {
            whereQuery.push(` client_info->'ip' ILIKE '%${clientIP}%'`);
        }

        if (logged_in_dt) {
            whereQuery.push(` logged_in_dt::date =  '${logged_in_dt}'::date`);
        }

        if(logged_out_dt){
            whereQuery.push(` logged_out_dt::date =  '${logged_out_dt}'::date`);
        }

        if(last_access_dt){
            whereQuery.push(` last_access_dt::date =  '${last_access_dt}'::date`);
        }

        if(login_source){
            whereQuery.push(` login_source = '${login_source}'`);
        }

        const sql = SQL`SELECT 
                              ul.id
                            , client_info
                            , ul.client_info->'ip' AS ip_address
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                ELSE TRIM(u.first_name)
                            END  as username
                            , ul.logged_in_dt
                            , ul.logged_out_dt
                            , ul.last_access_dt
                            , ul.login_source
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM 
                            users u
                        INNER JOIN user_log ul ON ul.user_id = u.id `;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        sql.append(SQL` ORDER BY  `)
            .append(sortField)
            .append(' ')
            .append(sortOrder)
            .append(SQL` LIMIT ${pageSize}`)
            .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);

        return await query(sql);
    },

    getDataById: async (params) => {
        const { id } = params;

        const sql = SQL`SELECT 
                              user_id
                            , client_info
                            , session_id
                            , ul.client_info->'ip' AS ip_address
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                ELSE TRIM(u.first_name)
                            END  as username
                            , ul.logged_in_dt
                            , ul.logged_out_dt
                            , ul.last_access_dt
                            , ul.login_source
                        FROM 
                            users u
                        INNER JOIN user_log ul ON ul.user_id = u.id 
                        WHERE ul.id = ${id} `;

        return await query(sql);
    },

};
