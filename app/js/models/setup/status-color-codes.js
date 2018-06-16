define(['backbone'], function (Backbone) {
    var statusColorCodesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/status_color_codes",
        defaults: {
            companyId: "",
            processType: "",
            processStatus: "",
            colorCode: ""
        },
        initialize: function (models) {
        }
    });
    return statusColorCodesModel;
});
