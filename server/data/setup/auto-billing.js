const {
    SQL,
    query,
    queryWithAudit
} = require('../index');

const logger = require('../../../logger');


const debugCallAndQuery = (params, sql) => {
    logger.info('USING PARAMS: ', params);
    // logger.info('QUERY TEXT: ', sql.text)
    // logger.info('QUERY VALUES: ', sql.values)
    // logger.info('QUERY SQL: ', sql.sql)
};

const WILDCARD_ID = "0";


module.exports = {

    getAutobillingRules: async (params) => {

        const {
            autobilling_rule_description,
            study_status,
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

        if (study_status) { //} && study_status !== WILDCARD_ID) {
            filterQuery.append(SQL`
                AND abr.study_status = ${study_status}
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
                , abr.claim_status_id   AS claim_status_id
                , cs.description        AS claim_status_description
                , abr.inactivated_dt    AS inactivated_dt
                , CASE
                    WHEN abr.inactivated_dt is null THEN true
                    ELSE false
                    END is_active
            FROM
                billing.autobilling_rules abr
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
            abr.id
            , description
            , claim_status_id
            , inactivated_dt
            , array_agg(study_status_code) as study_status_codes
            , abr_study_status.excludes as exclude_study_statuses
            , array_agg(DISTINCT facility_id) as facility_ids
            , abr_facilities.excludes as exclude_facilities
        FROM
            billing.autobilling_rules abr
            LEFT JOIN billing.autobilling_study_status_rules abr_study_status ON abr_study_status.autobilling_rule_id = abr.id
            LEFT JOIN billing.autobilling_facility_rules abr_facilities ON abr_facilities.autobilling_rule_id = abr.id
        WHERE
            abr.id = ${id}
        GROUP BY
            abr.id
            , abr_study_status.excludes
            , abr_facilities.excludes
        `;
        return await query(sql);
    },

    createAutobillingRule: async (params) => {

        const {
            description,
            claim_status_id,
            inactive,
            userId,

            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

        } = params;

        const sql = SQL`
            WITH abrInsert AS (
                INSERT INTO billing.autobilling_rules (
                    description
                    , claim_status_id
                    , inactivated_dt
                    , created_by
                )
                VALUES (
                    ${description}
                    , ${claim_status_id}
                    , ${inactive ? 'now()' : null }
                    , ${userId}
                )
                RETURNING id
            )
            , studyStatusesInsert AS (
                INSERT INTO billing.autobilling_study_status_rules (
                    autobilling_rule_id
                    , study_status_code
                    , excludes
                )
                VALUES (
                    (SELECT id FROM abrInsert)
                    , UNNEST(${study_status_codes}::text[])
                    , ${exclude_study_statuses}
                )
            )
            , facilitiesInsert AS (
                INSERT INTO billing.autobilling_facility_rules (
                    autobilling_rule_id
                    , facility_id
                    , excludes
                )
                VALUES(
                    (SELECT id FROM abrInsert)
                    , UNNEST(${facility_ids}::int[])
                    , ${exclude_facilities}
                )
            )
            SELECT id FROM abrInsert
        `;
        debugCallAndQuery(params, sql);
        return await query(sql);
    },

    updateAutobillingRule: async (params) => {
        const {
            id,
            description,
            claim_status_id,
            study_status,
            inactive,

            study_status_codes,
            exclude_study_statuses,

            facility_ids,
            exclude_facilities,

        } = params;


        const sql = SQL`
            WITH
                facilitiesCleanSlate AS (
                    DELETE FROM billing.autobilling_facility_rules WHERE autobilling_rule_id = ${id}
                )
                , studyStatusesCleanSlate AS (
                    DELETE FROM billing.autobilling_study_status_rules WHERE autobilling_rule_id = ${id}
                )
                , studyStatusesInsert AS (
                    INSERT INTO billing.autobilling_study_status_rules (
                        autobilling_rule_id
                        , study_status_code
                        , excludes
                    )
                    VALUES (
                        ${id}
                        , UNNEST(${study_status_codes}::text[])
                        , ${exclude_study_statuses}
                    )
                )
                , facilitiesInsert AS (
                    INSERT INTO billing.autobilling_facility_rules (
                        autobilling_rule_id
                        , facility_id
                        , excludes
                    )
                    VALUES(
                        ${id}
                        , UNNEST(${facility_ids}::int[])
                        , ${exclude_facilities}
                    )
                )

            UPDATE billing.autobilling_rules
            SET
                description = ${description}
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

    executeAutobillingRules: async (params) => {
        const {
            studyId,
            studyStatus,
        } = params;


        const sql = SQL`
            WITH study_info AS (
                SELECT
                    facility_id
                FROM
                    studies
                WHERE
                    id = ${studyId}
            )
            , abr AS (
                SELECT
                    id
                    , claim_status_id

                FROM
                    billing.autobilling_rules
                WHERE
                    study_status = ${studyStatus}
             )
             , abr_facilities AS (
                SELECT
                    excludes
                    , facility_id
                FROM
                    billing.autobilling_facility_rules
                    RIGHT JOIN abr ON abr.id = autobilling_rule_id
             )
             SELECT * FROM abr_facilities;

        `;
        debugCallAndQuery(params, sql);

        return await query(sql);
    },


};
