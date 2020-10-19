define(['backbone','models/setup/submission-types'], function (Backbone, submissionTypesModel) {

    var submissionTypesList = Backbone.Collection.extend({
        model: submissionTypesModel,
        url: "/exa_modules/billing/setup/submission_types",

        parse: function (response) {
            return response;
        }
    });
    return submissionTypesList;
});
