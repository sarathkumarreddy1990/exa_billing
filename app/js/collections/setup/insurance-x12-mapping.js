define(['backbone','models/setup/insurance-x12-mapping'], function (Backbone,insuranceX12MappingModel) {

    var insuranceX12MappingList = Backbone.Collection.extend({
        model: insuranceX12MappingModel,
        url: "/exa_modules/billing/setup/insurance_x12_mapping",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return insuranceX12MappingList;
});