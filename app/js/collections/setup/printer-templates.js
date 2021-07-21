define(['backbone','models/setup/printer-templates'], function (Backbone,PaperClaimTemplatesModel) {

    var PaperClaimTemplatesList = Backbone.Collection.extend({
        model: PaperClaimTemplatesModel,
        url: "/exa_modules/billing/setup/printer_templates",

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }

    });
    return PaperClaimTemplatesList;
});