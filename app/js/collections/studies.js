
define([ 'backbone','models/study'], function ( Backbone,StudyModel) {
    return Backbone.Collection.extend({
        'model': StudyModel,
        'url': '/exa_modules/billing/studies',
        'initialize': function ( models, options ) {
            var self = this;

//            function setupEvents () {
//                self.off('request', setupEvents);
//                if ( options && options.filterID ) {
//                    self.on(_events(options.filterID));
//                }
//            }
//
//            this.on('request', setupEvents);
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

