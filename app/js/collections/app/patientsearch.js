define(['backbone', 'models/app/patientDetails'], function(Backbone){
    Backbone.emulateHTTP = true;
    var patients = Backbone.Collection.extend({
        url:'/exa_modules/billing/pending_payments/patient_search',
        defaults: { module: 'patient'},
        parse:function(response){
            return response.result;
        }
    });

    return patients;
});
