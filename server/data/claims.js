const { query, SQL } = require('./index');

module.exports = {

    getLineItemsDetails: async function (params) {
        const studyIds = params.study_ids.split('~').map(Number);
        let sql = SQL`
                     SELECT json_agg(row_to_json(charge)) "charges" FROM
                     (SELECT
                           sc.id AS study_cpt_id
                         , s.study_dt
                         , s.facility_id
                         , s.accession_no
                         , sc.study_id            
                         , sc.cpt_code
                         , COALESCE(sc.study_cpt_info->'modifiers1', '') AS m1
                         , COALESCE(sc.study_cpt_info->'modifiers2', '') AS m2
                         , COALESCE(sc.study_cpt_info->'modifiers3', '') AS m3
                         , COALESCE(sc.study_cpt_info->'modifiers4', '') AS m4
                         , string_to_array(regexp_replace(study_cpt_info->'diagCodes_pointer', '[^0-9,]', '', 'g'),',')::int[] AS icd_pointers
                         , COALESCE(sc.study_cpt_info->'bill_fee','1')::NUMERIC AS bill_fee
                         , COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC AS allowed_fee
                         , COALESCE(sc.study_cpt_info->'units','1')::NUMERIC AS units
                         , ( COALESCE(sc.study_cpt_info->'bill_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC ) AS total_bill_fee
                         , ( COALESCE(sc.study_cpt_info->'allowed_fee','0')::NUMERIC * COALESCE(sc.study_cpt_info->'units','1')::NUMERIC ) AS total_allowed_fee
                         , sc.authorization_info->'authorization_no' AS authorization_no
                         , display_description
                         , additional_info
                         , sc.cpt_code_id
                     FROM study_cpt sc
                     LEFT JOIN studies s ON s.id = sc.study_id
                     INNER JOIN cpt_codes on sc.cpt_code_id = cpt_codes.id
                     WHERE study_id = ANY(${studyIds}) AND sc.cpt_code_id > 0  ORDER BY s.accession_no DESC
                     ) AS charge `;

        return await query(sql);
    }
};
