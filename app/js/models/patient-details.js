define([ 'backbone' ], function ( Backbone ) {
    return Backbone.Model.extend({
        defaults: {
            "patient_id": 0,
            "dicom_patient_id": "",
            "prefix_name": "",
            "first_name": "",
            "middle_name": "",
            "last_name": "",
            "suffix_name": "",
            "birth_date": "",
            "old_birth_date": "",
            "gender": "",
            "old_gender": "",
            "last_edit_by": 0,
            "study_count": 0,
            "notes": [],
            "mothers_maiden": "",
            "id_information": "",
            "contact_info1": "",
            "contact_info2": "",
            "additional_info": "",
            "account_no": "",
            "old_account_no": "",
            "account_no_history": [],
            "alerts": "",
            "ref_provider_id": 0,
            "company_id": 0,
            "facility_id": 0,
            "owner_id": 0,
            "patient_type": '',
            "is_active": true,
            "has_deleted": false,
            "full_name": '',
            "old_full_name": '',
            "module": "patient",
            "changed": false,
            "audit_information": "",
            "patient_details": {}
        },

        url:'/exa_modules/billing/patient',
        initialize: function() {
            
        },

        parse:function(result){
            return result.patientList;
        }

    });
});
