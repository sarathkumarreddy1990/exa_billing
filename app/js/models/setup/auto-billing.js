define(['backbone'], function (Backbone) {
    var AutoBillingModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/auto_billing",

        defaults: {
            templateName : ""
        },

        initialize: function (models) {
        }
    });
    return AutoBillingModel;
});
