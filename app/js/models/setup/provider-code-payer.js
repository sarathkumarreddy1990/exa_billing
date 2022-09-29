define(['backbone'], function (Backbone) {
    var providerIdCodeModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/provider_id_codes",
        defaults: {
            insurance_name:"",
            payer_assigned_provider_id:"",
            qualifier_desc:"",
            isActive: "",
            company_id: ""
        },
        initialize: function (models) {
        }
    });
    
    return providerIdCodeModel;
});