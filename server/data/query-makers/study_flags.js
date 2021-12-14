'use strict';

module.exports = ( fieldID, fieldValue ) => {
    let value = fieldValue.split(',').map(Number);

    return `
        EXISTS (
            SELECT
                  s.id AS study_id
                , ARRAY_AGG(saf.flag_id) AS flag_id
            FROM
                studies s
            LEFT JOIN study_assigned_flags saf ON saf.study_id = s.id
            WHERE s.id = studies.id
                AND saf.flag_id = ANY(ARRAY[${value}])
            GROUP BY s.id
        )
    `;
}