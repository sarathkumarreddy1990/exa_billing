define(['backbone'], function (Backbone) {
    var casGroupCodesModel = Backbone.Model.extend({

        url: "/exa_modules/billing/cas_group_codes",

        defaults: {
            code: "",
            name: "",
            description: "",
            is_active: ""
        },

        initialize: function (models) {
        }
    });
    return casGroupCodesModel;
});
