const { SQL, query } = require('../index');

module.exports = {

    getData: async function (params) {
        let whereQuery = [];
        params.sortOrder = params.sortOrder || ' ASC';
        let {
            username,
            screen_name,
            description,
            fromDate,
            toDate,
            sortOrder,
            sortField,
            pageNo,
            pageSize
        } = params;

        if (username) {
            whereQuery.push(`u.last_name ILIKE '%${username}%' OR u.first_name ILIKE '%${username}%'`);
        }

        if (screen_name) {
            whereQuery.push(` al.screen_name ILIKE '%${screen_name}%'`);
        }

        if(description){
            whereQuery.push( `al.description ILIKE  '%${description}%'`);
        }

        if(fromDate && toDate){
            whereQuery.push(` al.created_dt BETWEEN  '${fromDate}' AND '${toDate}'`);
        }

        const sql = SQL`SELECT
                               al.id
                            ,  al.company_id
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                    THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                ELSE TRIM(u.first_name)
                                END  as username 
                            , al.client_ip 
                            , al.created_dt
                            , al.entity_name 
                            , al.screen_name
                            , al.module_name 
                            , al.description 
                            , COUNT(1) OVER (range unbounded preceding) AS total_records
                        FROM billing.audit_log al    
                        INNER JOIN public.users u ON u.id = al.created_by`;

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
                              al.company_id 
                            , CASE WHEN LENGTH(TRIM(u.last_name)) > 0
                                    THEN COALESCE(TRIM(u.last_name),'') ||' '|| COALESCE(TRIM(u.first_name),'')
                                    ELSE TRIM(u.first_name)
                                END  as username 
                            , al.client_ip 
                            , al.created_dt
                            , al.entity_name 
                            , al.screen_name
                            , al.module_name 
                            , al.description 
                            , p.full_name
                            , al.changes
                        FROM billing.audit_log al    
                        INNER JOIN public.users u ON u.id = al.created_by
                        LEFT JOIN public.patients p ON p.id = CASE WHEN entity_name = 'claims' THEN al.entity_key ELSE null END 
                        WHERE al.id = ${id} `;

        return await query(sql);
    }

};
