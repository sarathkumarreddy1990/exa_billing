const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';
 
        let {
            name,
            receiverName,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            isFrom
        } = params;

        let whereQuery = [];

        if (name) {
            whereQuery.push(` code ILIKE '%${name}%'`);
        }

        if (receiverName) {
            whereQuery.push(` description ILIKE '%${receiverName}%'`);
        }

        const sql = SQL`SELECT 
                            id
                            , company_id
                            , inactivated_dt
                            , code
                            , name
                            , receiver_name
                            , receiver_id
                            , communication_info
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.edi_clearinghouses`;

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        if (isFrom != 'InsuranceEDIMapping') {
            sql.append(SQL ` ORDER BY `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(SQL ` LIMIT ${pageSize}`)
                .append(SQL ` OFFSET ${((pageNo * pageSize) - pageSize)}`);
        }
        
        return await query(sql);

    },

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT 
                              id
                              , company_id
                              , inactivated_dt
                              , code
                              , name
                              , receiver_name
                              , receiver_id
                              , communication_info
                        FROM   billing.edi_clearinghouses
                        WHERE 
                            id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            company_id,
            code,
            name,
            receiverName,
            receiverId,
            communicationInfo,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';

        communicationInfo = JSON.parse(communicationInfo);

        const sql = SQL` INSERT INTO billing.edi_clearinghouses
                                                (   company_id
                                                  , inactivated_dt
                                                  , code
                                                  , name
                                                  , receiver_name
                                                  , receiver_id
                                                  , communication_info)
                                                values
                                                (
                                                    ${company_id}
                                                  , ${inactivated_dt}
                                                  , ${code}
                                                  , ${name}
                                                  , ${receiverName}
                                                  , ${receiverId}
                                                  , ${communicationInfo} )
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Created ${code}(${name})`
        });
    },

    update: async function (params) {

        let {
            id,
            code,
            name,
            receiverName,
            receiverId,
            communicationInfo,
            isActive } = params;
        let inactivated_dt = isActive ? null : 'now()';
        communicationInfo = JSON.parse(communicationInfo);

        const sql = SQL` UPDATE
                              billing.edi_clearinghouses
                         SET
                              code = ${code}
                            , name = ${name}
                            , receiver_name = ${receiverName}
                            , receiver_id = ${receiverId}
                            , communication_info = ${communicationInfo}
                            , inactivated_dt = ${inactivated_dt}
                         WHERE
                              id = ${id}
                              RETURNING *,
                                (
                                    SELECT row_to_json(old_row) 
                                    FROM   (SELECT * 
                                            FROM   billing.edi_clearinghouses 
                                            WHERE  id = ${id}) old_row 
                                ) old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Updated ${code}(${name})`
        });
    },

    delete: async function (params) {

        let { id } = params;

        const sql = SQL` DELETE FROM
                             billing.edi_clearinghouses
                         WHERE
                             id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: 'Deleted.'
        });
    }
};