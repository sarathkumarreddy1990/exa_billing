const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

const logger = require('../../../logger');


const debugCallAndQuery = (params, sql) => {
    logger.info('USING PARAMS: ', params);
    logger.info('QUERY TEXT: ', sql.text)
    logger.info('QUERY VALUES: ', sql.values)
    logger.info('QUERY SQL: ', sql.sql)
};

const WILDCARD_ID = "0";

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
                , inactivated_dt
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
            is_active,
            userId,
        } = params;

        const sql = SQL`
            INSERT INTO billing.autobilling_rules (
                description
                , claim_status_id
                , study_status_id
                , inactivated_dt
                , created_by
            )
            VALUES (
                ${description}
                , ${claim_status_id}
                , ${study_status_id}
                , ${is_active ? null : 'now()' }
                , ${userId}
            )
            RETURNING id
        `;
        return await query(sql);
    },

    updateAutobillingRule: async (params) => {
        const {
            id,
            description,
            claim_status_id,
            study_status_id,
            inactive,
        } = params;


        const sql = SQL`
            WITH
                facilities_clean_slate AS (
                    DELETE FROM billing.autobilling_facility_rules WHERE autobilling_rule_id = ${id}
                )
                , insert_autobilling_facilities AS (
                    INSERT INTO billing.autobilling_facility_rules(
                        autobilling_rule_id
                        , facility_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST()
                    )
                    WHERE autobilling_rule_id = ${id}
                )

            UPDATE billing.autobilling_rules
            SET
                description = ${description}
                , study_status_id = ${study_status_id}
                , claim_status_id = ${claim_status_id}
                , inactivated_dt = ${inactive ? "now()": null}
            WHERE
                id = ${id}
            RETURNING ${id}
        `;

        debugCallAndQuery(params, sql);

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
