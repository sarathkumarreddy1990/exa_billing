const { query, SQL, queryWithAudit } = require('../index');

module.exports = {

    getData: async function (params) {

        params.sortOrder = params.sortOrder || ' DESC';

        let {
            name,
            receiver_name,
            edi_template_name,
            sortOrder,
            sortField,
            pageNo,
            pageSize,
            isFrom
        } = params;

        let whereQuery = [];

        if (name) {
            whereQuery.push(` ech.name ILIKE '%${name}%'`);
        }

        if (receiver_name) {
            whereQuery.push(` receiver_name ILIKE '%${receiver_name}%'`);
        }

        if (edi_template_name) {
            whereQuery.push(` et.name ILIKE '%${edi_template_name}%'`);
        }

        sortField = sortField == 'name' ? 'ech.name' : sortField;

        const sql = SQL`SELECT
                              ech.id
                            , ech.company_id
                            , ech.inactivated_dt
                            , ech.code
                            , ech.name
                            , ech.receiver_name
                            , et.name AS edi_template_name
                            , ech.receiver_id
                            , ech.communication_info
                            , COUNT(1) OVER (range unbounded preceding) as total_records
                        FROM   billing.edi_clearinghouses ech
                        LEFT JOIN billing.edi_templates et ON et.id = ech.edi_template_id`;

        if (isFrom == 'InsuranceEDIMapping') {
            sql.append(SQL` WHERE ech.inactivated_dt IS NULL`);
        }

        if (whereQuery.length) {
            sql.append(SQL` WHERE `)
                .append(whereQuery.join(' AND '));
        }

        if (isFrom != 'InsuranceEDIMapping') {
            sql.append(SQL` ORDER BY `)
                .append(sortField)
                .append(' ')
                .append(sortOrder)
                .append(SQL` LIMIT ${pageSize}`)
                .append(SQL` OFFSET ${((pageNo * pageSize) - pageSize)}`);
        }

        return await query(sql);

    },

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT
                                ech.id
                              , ech.company_id
                              , ech.inactivated_dt
                              , ech.code
                              , ech.name
                              , ech.receiver_name
                              , et.id AS edi_template_name
                              , ech.receiver_id
                              , ech.communication_info
                        FROM   billing.edi_clearinghouses ech
                        LEFT JOIN billing.edi_templates et ON et.id = ech.edi_template_id
                        WHERE
                        ech.id = ${id} `;

        return await query(sql);
    },

    create: async function (params) {

        let {
            company_id,
            code,
            name,
            receiverName,
            ediTemplateName,
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
                                                  , edi_template_id
                                                  , receiver_id
                                                  , communication_info)
                                                values
                                                (
                                                    ${company_id}
                                                  , ${inactivated_dt}
                                                  , ${code}
                                                  , ${name}
                                                  , ${receiverName}
                                                  , ${ediTemplateName}
                                                  , ${receiverId}
                                                  , ${communicationInfo} )
                                                  RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Add: New EDI Clearing House(${name}) created`
        });
    },

    update: async function (params) {

        let {
            id,
            code,
            name,
            receiverName,
            ediTemplateName,
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
                            , edi_template_id = ${ediTemplateName}
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
            logDescription: `Update: EDI Clearing House(${name}) updated`
        });
    },

    delete: async function (params) {

        let {
            id,
            name,
            receiverName
        } = params;

        const sql = SQL` DELETE FROM
                             billing.edi_clearinghouses
                         WHERE
                             id = ${id} RETURNING *, '{}'::jsonb old_values`;

        return await queryWithAudit(sql, {
            ...params,
            logDescription: `Deleted ${receiverName}(${name})`
        });
    }
};
