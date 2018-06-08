define(['backbone', 'models/setup/study-filter'], function (Backbone, studyFilterModel) {

    var studyFilterCollection = Backbone.Collection.extend({
        model: studyFilterModel,
        url: "/exa_modules/billing/setup/study_filters",
        initialize: function () {
        },

        parse: function (response) {
            var rows = response;
            return Array.isArray(rows) ? rows.map(function (row) {
                row.id = row.filter_id || row.id || '';
                return row;
            }) : rows;
        }

    });
    return studyFilterCollection
});