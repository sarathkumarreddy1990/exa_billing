define(['backbone','models/setup/status-color-codes'], function (Backbone,statusColorCodesModel) {

    var statusColorCodesList = Backbone.Collection.extend({
        model: statusColorCodesModel,
        url: "/exa_modules/billing/setup/status_color_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return statusColorCodesList;
});