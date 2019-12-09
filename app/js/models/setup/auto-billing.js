define(['backbone'], function (Backbone) {
    var AutoBillingModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/printer_templates",

        defaults: {
            templateName : ""
        },

        initialize: function (models) {
        }
    });
    return AutoBillingModel;
});
