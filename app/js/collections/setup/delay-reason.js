define(['backbone', 'models/setup/delay-reasons'], function (Backbone, DelayReasonModel) {

    var DelayReasonList = Backbone.Collection.extend({
        model: DelayReasonModel,
        url: "/exa_modules/billing/setup/delay_reasons",

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }

    });
    return DelayReasonList;
});
