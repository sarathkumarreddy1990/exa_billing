define(['backbone'], function (Backbone) {
    var DelayReasonModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/delay_reasons",

        defaults: {
        },

        initialize: function () {
        }
    });
    return DelayReasonModel;
});
