define(['backbone'], function (Backbone) {
    var AdjustmentCodesModel = Backbone.Model.extend({

        url: "/exa_modules/billing/setup/adjustment_codes",

        defaults: {
            code: "",
            description: "",
            type: "",
            is_active: "",
            company_id:"",
        },

        initialize: function (models) {
        }
    });
    return AdjustmentCodesModel;
});
