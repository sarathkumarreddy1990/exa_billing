const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

// const logger = require('../../../logger');

const WILDCARD_ID = 0;

module.exports = {

    getAutobillingRules: async (params) => {

        const {
            autobilling_rule_description,
            study_status_id,
            claim_status_id,
        } = params;

        let filterQuery = SQL`
            WHERE
                abr.deleted_dt is null
        `;

        if (autobilling_rule_description) {
            let term = autobilling_rule_description;
            if (term.length === 1) {
                term = '%' + term;
            }
            term += '%';
            filterQuery.append(SQL`
                AND abr.description ILIKE ${term}
            `);
        }

        if (study_status_id && study_status_id !== WILDCARD_ID) {
            filterQuery.append(SQL`
                AND abr.study_status_id = ${study_status_id}
            `);
        }

        if (claim_status_id && claim_status_id !== WILDCARD_ID) {
            filterQuery.append(SQL`
                AND abr.claim_status_id = ${claim_status_id}
            `);
        }

        const selectionQuery = SQL`
            SELECT
                abr.id
                , abr.description       AS autobilling_rule_description
                , abr.study_status_id   AS study_status_id
                , ss.status_desc        AS study_status_description
                , abr.claim_status_id   AS claim_status_id
                , cs.description        AS claim_status_description
                , abr.inactivated_dt    AS inactivated_dt
                , CASE
                    WHEN abr.inactivated_dt is null THEN true
                    ELSE false
                    END is_active
            FROM
                billing.autobilling_rules abr
                LEFT JOIN public.study_status ss ON ss.id = abr.study_status_id
                LEFT JOIN billing.claim_status cs ON cs.id = abr.claim_status_id
        `;

        return await query(selectionQuery.append(filterQuery));
    },

    getAutobillingRule: async (params) => {
        const {
            id,
        } = params;

        const sql = SQL`
            SELECT
                id
                , description
                , study_status_id
                , claim_status_id

            FROM
                billing.autobilling_rules
            WHERE
                id = ${id}
        `;
        return await query(sql);
    },

    createAutobillingRule: async (params) => {

        const {
            description,
            claim_status_id,
            study_status_id,
        } = params;

        const sql = SQL`
            INSERT INTO billing.autobilling_rules (
                description
                , claim_status_id
                , study_status_id
            )
            VALUES (
                ${description}
                , ${claim_status_id}
                , ${study_status_id}
            )
            RETURNING id
        `;
        return await query(sql);
    },

    updateAutobillingRule: async (params) => {
        const {
            id,
            claim_status_id,
            study_status_id,
        } = params;


        logger.info('UPDATING: ', params);

        const sql = SQL`
            UPDATE billing.autobilling_rules
            SET
                study_status_id = ${study_status_id}
                , claim_status_id = ${claim_status_id}
            WHERE
                id = ${id}
            RETURNING ${id}
        `;
        return await query(sql);

    },

    deleteAutobillingRule: async (params) => {
        const {
            id,
        } = params;

        const sql = SQL`
            UPDATE billing.autobilling_rules
            SET
                deleted_dt = now()
            WHERE
                id = ${id}
            RETURNING id
        `;
        return await query(sql);
    },
};
