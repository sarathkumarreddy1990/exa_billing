define([ 'backbone', 'models/claim-filters' ], function ( Backbone, CliamFilterModel ) {
    return Backbone.Collection.extend({
        model: CliamFilterModel,
        url:'/exa_modules/billing/claim_filters',
        parse:function( response ){
            var rows = response;
            return Array.isArray(rows) ? rows.map(function ( row ) {
                row.id = row.filter_id || row.id || '';
                return row;
            }) : rows;
        }
    });
});
