const { query } = require('./index');



module.exports = {

    getData: async function () {

        return await query(`
                        SELECT id as filter_id,*
                        FROM   study_filters
                        order by id desc
                        LIMIT  10 `);
    },

    getUserWLFilters: async function (args) {

        const sqlQuery = `
            SELECT
                worklist_filter_info    AS perms_filter,
                row_to_json(u.*)        AS user_details,
                (select exists(
                        select
                            1
                        from
                            user_study_assignments us
                        full join user_patient_assignments up on up.user_id = $1
                        where us.user_id = $1
                        )
                    )                   AS has_assigned_studies,
                studyfilter.*
            FROM
                user_settings
            JOIN LATERAL (
                SELECT
                    user_type,
                    facilities,
                    default_facility_id,
                    all_facilities,
                    user_group_id
                FROM users
                    WHERE id = user_id
                ) u ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    sf.filter_info     AS filter_info,
                    (
                        SELECT json_agg(joined) FROM
                        (
                            SELECT
                                sfj.filter_info
                            FROM
                                study_filters sfj
                            WHERE
                                sfj.id = ANY(sf.joined_filters || ARRAY[$2]::BIGINT[])
                        ) AS joined
                    )                  AS joined_filter_info
                FROM
                    study_filters sf
                WHERE
                    sf.id = $2
            ) AS studyfilter ON true
            WHERE
                user_id = $1
        `;

        return await query(sqlQuery, [1, args.id]);
    }
};
