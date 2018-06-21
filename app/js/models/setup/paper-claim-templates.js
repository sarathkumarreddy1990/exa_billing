define(['backbone'], function (Backbone) {
    var PaperClaimTemplatesModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/paper_claim_templates",

        defaults: {
            templateName : ""
        },

        initialize: function (models) {
        }
    });
    return PaperClaimTemplatesModel;
});
