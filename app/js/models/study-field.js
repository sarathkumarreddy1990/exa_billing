define([ 'backbone' ], function ( Backbone ) {
    var validate = function ( attrs ) {
        if ( !attrs.hasOwnProperty('field_info') || !attrs.field_info.custom_name ) {
            return true;
        }
    };

    return Backbone.Model.extend({
        'default': {
            'field_code': '', // looks_like_this
            'field_info': {
                'cellattr': null,
                'custom_id': 0,
                'custom_name': '', // Looks Like This (matches field_name) - who knows why.
                'defaultValue': '',
                'formatter': null,
                'hidden': false,
                'index': '',
                'key': false,
                'name': '', // looks_like_this (matches field_code) - for whatever reason.
                'search': false,
                'searchColumns': [],
                'searchCondition': '',
                'searchFlag': '',
                'searchoptions': {
                    'tempvalue': '',
                    'value': ''
                },
                'searchoptionsalt': {
                    'alttempvalue': '',
                    'value': ''
                },
                'sortable': false,
                'stype': '',
                'width': 0
            },
            'field_name': '', // Looks Like This
            'i18n_name': '',
            'id': 0
        },
        'validate': validate
    });
});
