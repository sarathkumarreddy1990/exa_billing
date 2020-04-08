define([
        'backbone'
      , 'modules/multichat/models/users'
      , 'modules/multichat/models/rooms'
      , 'modules/multichat/utils/errorHandler'
    ],
    function (
        Backbone
      , Users
      , Rooms
      , ErrorHandler
    ) {

        var searchModel = Backbone.Model.extend({
            defaults: {
                users: null,
                rooms: null,
            },

            initialize: function (options) {
                _.extend(this, ErrorHandler);
                this.url = '/chat/search?' + $.param({ name_substring: options.searchString, room_type: options.roomType });
            },

            parse: function (response, options) {
                var self = this;
                if (response.status == 'ok' && 'result' in response && 'users' in response.result && Array.isArray(response.result.users)) {
                    self.attributes.users = new Users.UsersCollection(response.result.users);
                    self.attributes.rooms =  new Rooms.RoomsCollection(null, {usersCache: app.chat.chatModel._usersCache});
                    self.attributes.rooms.addRooms(response);
                }
                return null;
            },
        });

      return searchModel;
    });


