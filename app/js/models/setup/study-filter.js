define(['backbone'], function (Backbone) {
    var studyFilterModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/study_filters",
        defaults: {
          
        },
        initialize: function (models) {
        }
    });
    return studyFilterModel;
});
