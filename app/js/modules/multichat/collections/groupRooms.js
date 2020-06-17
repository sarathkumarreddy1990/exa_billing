define(['backbone'], function (Backbone) {
    var ChatRoomList = Backbone.Collection.extend({
        url: '/chat/setup/group_rooms',

        initialize: function () {
        },

        parse: function (response) {
            return response.result;
        }
    });

    return ChatRoomList;
});
