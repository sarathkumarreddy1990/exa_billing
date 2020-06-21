define(['backbone'], function (Backbone) {
    var submissionTypesModel = Backbone.Model.extend({
        urlRoot: "/exa_modules/billing/setup/submission_types"
    });

    return submissionTypesModel;
});
