define(['backbone','models/setup/paper-claim-templates'], function (Backbone,PaperClaimTemplatesModel) {

    var PaperClaimTemplatesList = Backbone.Collection.extend({
        model: PaperClaimTemplatesModel,
        url: "/exa_modules/billing/setup/paper_claim_templates",

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }

    });
    return PaperClaimTemplatesList;
});