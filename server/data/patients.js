const { query, SQL } = require('./index');

module.exports = {

    getById: async function (params) {

        let { id } = params;

        const sql = SQL`SELECT
                            patients.id,
                            patients.dicom_patient_id,
                            patients.account_no,
                            patients.alt_account_no,
                            patients.account_no_history,
                            patients.patient_uid,
                            patients.prefix_name,
                            patients.first_name,
                            patients.middle_name,
                            patients.last_name,
                            patients.suffix_name,
                            coalesce(patients.gender,'') as gender,
                            patients.birth_date::text,
                            age(patients.birth_date) as age,
                            patients.patient_type,
                            patients.owner_id,
                            patients.last_edit_dt,
                            patients.last_edit_by,
                            patients.patient_info,
                            patients.notes,
                            patients.alerts,
                            patients.facility_id,
                            patients.company_id,
                            patients.is_active,
                            patients.has_deleted,
                            patients.deleted_dt,
                            patients.full_name,
                            patients.patient_uid_system,
                            patients.patient_details,
                            patients.rcopia_id,
                            patients.portal_info,
                            patients.portal_activated_dt,
                            patients.ordering_facilities,
                            vital_signs.more_info->'heightinInches' AS vital_height,
                            vital_signs.more_info->'weightinPounds' AS vital_weight
                        FROM patients
                            LEFT JOIN vital_signs ON patients.id = vital_signs.patient_id
                        WHERE
                            patients.id = ${id}
                    ORDER BY vital_signs.id DESC LIMIT 1  `;
        return await query(sql);
    }
};