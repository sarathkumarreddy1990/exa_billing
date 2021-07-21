define(['backbone'], function (Backbone) {
    var casGroupCodesModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/cas_group_codes",

        defaults: {
            code: "",
            name: "",
            description: "",
            isActive: "",
            companyId:"",
        },

        initialize: function (models) {
        }
    });
    return casGroupCodesModel;
});
