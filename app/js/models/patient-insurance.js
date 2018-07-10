define(['backbone'],function(Backbone){
    var patientInsuranceModel =Backbone.Model.extend({
        url:"/exa_modules/billing/claims/create_claim/get_patient_insurances",
        initialize:function(models){
        }
    });
    return patientInsuranceModel;
});

