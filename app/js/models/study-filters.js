define([ 'backbone' ], function ( Backbone ) {
    return Backbone.Model.extend({
        defaults:{
            'filter_name':"",
            'filter_order':"",
            'is_private_filter':"",
            'user_id':"",
            'filter_info':{},
            'display_as_tab':"",
            'id':null,
            'assigned_users': [],
            'assigned_groups': [],
            'joined_filters': null
        },
        url: '/studyFilter',
        initialize: function () {},
        parse: function ( response ) {
            return response.result || response;
        }
    });
});
