define(['backbone'], function (Backbone) {
    var casGroupCodesModel = Backbone.Model.extend({

        url: "/exa_modules/billing/setup/cas_group_codes",

        defaults: {
            code: "",
            name: "",
            description: "",
            is_active: "",
            company_id:"",
        },

        initialize: function (models) {
        }
    });
    return casGroupCodesModel;
});
