const { SQL, query } = require('../index');
const queryMakers = require('./../query-maker-map');
const generator = queryMakers.get('datetime');

module.exports = {
    getData: async function (params) {
        let whereQuery = [` screen_name IN ('Login','Logout') `];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            username,
            client_ip,
            logged_in_dt,
            login_source,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            customArgs,
            fromDate,
            toDate
        } = params;

        if (username) {
            whereQuery.push(`COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'') ILIKE '%${username}%' `);
        }

        if (client_ip) {
            whereQuery.push(` client_ip ILIKE '%${client_ip}%'`);
        }

        if (logged_in_dt) {
            const loggedInDateFilter = generator('logged_dt', logged_in_dt, customArgs);
            whereQuery.push(loggedInDateFilter);

        } else if (fromDate && toDate) {
            whereQuery.push(` logged_dt::date BETWEEN '${fromDate}'::date AND '${toDate}'::date`);
        }

        if (login_source) {
            whereQuery.push(` module_name = '${login_source}'`);
        }

        const sql = SQL`SELECT
                              al.id
                            , al.detailed_info
                            , al.client_ip
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                ELSE TRIM(u.first_name)
                            END  as username
                            , al.logged_dt AS logged_in_dt
                            , al.module_name
                            , al.screen_name
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM
                            users u
                        INNER JOIN audit_log al ON al.user_id = u.id
                        INNER JOIN companies on companies.id = ${params.companyId} `;

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
                              al.user_id
                            , al.detailed_info
                            , al.client_ip
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                ELSE TRIM(u.first_name)
                            END  as username
                            , al.logged_dt
                        FROM
                            users u
                        INNER JOIN audit_log al ON al.user_id = u.id
                        WHERE al.id = ${id} `;

        return await query(sql);
    },

};
