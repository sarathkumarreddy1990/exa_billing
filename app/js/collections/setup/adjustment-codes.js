define(['backbone','models/setup/adjustment-codes'], function (Backbone,adjustmentCodesModel) {

    var AdjustmentCodesList = Backbone.Collection.extend({
        model: adjustmentCodesModel,
        url: "/exa_modules/billing/setup/adjustment_codes",

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }

    });
    return AdjustmentCodesList;
});