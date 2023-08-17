
define([ 'backbone', 'models/claims-workbench'], function ( Backbone, claimsModel) {
    return Backbone.Collection.extend({
        'model': claimsModel,
        'url': '/exa_modules/billing/claim_workbench',
        'initialize': function () {
        },
        'parse': function ( response ) {
            var rows = response;
            return Array.isArray(rows) ? rows.map(function( row ) {
                if( typeof row === 'string' ) {
                    row.study_details = JSON.parse(row);
                }
                // TODO: Remove the line below once Backbone upgraded?
                // row.id = row.study_id || row.id;
                return row;
            }) : rows;
        }
    });
});

