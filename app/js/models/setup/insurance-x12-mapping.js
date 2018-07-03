define(['backbone'], function (Backbone) {
    var insuranceX12MappingModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/insurance_x12_mapping",
        defaults: {
            companyId: "",
            claimClearingHouse: ""
        },
        initialize: function (models) {
        }
    });
    return insuranceX12MappingModel;
});
