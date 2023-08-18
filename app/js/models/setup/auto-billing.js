define(['backbone'], function (Backbone) {
    var AutoBillingModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/auto_billing",

        defaults: {
        },

        initialize: function () {
        }
    });
    return AutoBillingModel;
});
