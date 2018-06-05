define(['backbone','models/setup/billing-classes'], function (Backbone,billingClassesModel) {

    var billingClassesList = Backbone.Collection.extend({
        model: billingClassesModel,
        url: "/exa_modules/billing/setup/billing_classes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return billingClassesList;
});