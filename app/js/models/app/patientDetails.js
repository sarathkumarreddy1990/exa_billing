var tmp1 = null;
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

        url:'/exa_modules/billing/pending_payments/patient',
        initialize: function() {
            this.on("change:first_name", function(model) {
                if((model.get("first_name") != model.previous("first_name")) && model.get("changed")) {
                    var auditinformation = "patient firstname " + model.previous("first_name")  + " changed to " + model.get("first_name");
                    auditinformation = (model.get("audit_information") == "") ? auditinformation : model.get("audit_information")+ "," + auditinformation;
                    var audit_info = {
                        "columninfo" :auditinformation
                    };
                    model.set("audit_info",commonjs.hstoreStringify(audit_info));
                }
            });
            this.on("change:last_name", function(model){
                if((model.get("last_name") != model.previous("last_name")) && model.get("changed")) {
                    var auditinformation = "patient lastname "  + model.previous("last_name")  + " changed to " + model.get("last_name");
                    auditinformation = (model.get("audit_information") == "") ? auditinformation : model.get("audit_information")+ "," + auditinformation;
                    var audit_info = {
                        "columninfo" :auditinformation
                    };
                    model.set("audit_info",commonjs.hstoreStringify(audit_info));
                }
            });
            this.on("change:gender", function(model){
                if((model.get("gender") != model.previous("gender")) && model.get("changed")) {
                    var auditinformation = "patient gender " + model.previous("gender")  + " changed to " + model.get("gender");
                    auditinformation = (model.get("audit_information") == "") ? auditinformation : model.get("audit_information")+ "," + auditinformation;
                    var audit_info = {
                        "columninfo" :auditinformation
                    };
                    model.set("audit_info",commonjs.hstoreStringify(audit_info));
                }
            });
            this.on("change:birth_date", function(model) {
                if (model.get("changed") && (model.get("birth_date") != model.previous("birth_date"))) {
                //if((commonjs.getFormattedDate(model.get("birth_date")) != commonjs.getFormattedDate(model.previous("birth_date"))) && model.get("changed")) {
                    var auditinformation = "patient birthdate" + model.previous("birth_date")  + " changed to " + model.get("birth_date");
                    auditinformation = (model.get("audit_information") == "") ? auditinformation : model.get("audit_information")+ "," + auditinformation;
                    var audit_info = {
                        "columninfo" :auditinformation
                    };
                    model.set("audit_info",commonjs.hstoreStringify(audit_info));
                }
            });
            this.on("sync", function ( model, data ) {
                var root = parent && parent.commonjs ?
                           parent.commonjs :
                           commonjs;
                if ( model.get('patient_id') > 0 && model.changed ) {
                    root.updateInfo(model.id, 'patient');
                }
            });
        },

        parse:function(result){
            return result.patientList;
        }

    });
});
