define([ 'backbone', 'models/studyFilters' ], function ( Backbone, StudyFilterModel ) {
    return Backbone.Collection.extend({
        model: StudyFilterModel,
        url:'/exa_modules/billing/studyFilters',
        parse:function( response ){
            var rows = response;
            return Array.isArray(rows) ? rows.map(function ( row ) {
                row.id = row.filter_id || row.id || '';
                return row;
            }) : rows;
        }
    });
});
