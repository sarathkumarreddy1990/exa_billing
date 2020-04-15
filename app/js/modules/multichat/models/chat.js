define([
        'backbone'
      , 'socket.io-client'
      , 'modules/multichat/models/users'
      , 'modules/multichat/models/rooms'
      , 'modules/multichat/models/messages'
      , 'modules/multichat/models/searchusers'
      , 'modules/multichat/utils/errorHandler'
      , 'modules/multichat/utils/triggers'
    ],
    function (
        Backbone
      , io
      , Users
      , Rooms
      , MessagesCollection
      , SearchUsersCollection
      , ErrorHandler
    ) {
        var ChatModel = Backbone.Model.extend({
            defaults: {
                rooms: null,
                me: null,
                minimized: false

            },
            initializeSocket: function (cb) {
                var self = this;
                var location = window.location.protocol + "//" + window.location.hostname
                    + (window.location.port ? ':' + window.location.port : '')
                    + '/chat/send';

                var chat_socket = io.connect(location, {
                    path: '/chat_socket',
                    forceNew: true,
                    transports: ['websocket']
                });
                this._chat_socket = chat_socket;
                var callbackFired = false;

                chat_socket.once('connect', function () {
                    chat_socket.on('messagesUpdates', function (data) {
                        if (data && 'updated_messages' in data && Array.isArray(data.updated_messages)) {
                            self._dispatchWS_messagesUpdates(data.updated_messages);
                        }
                    });
                    chat_socket.on('roomsUpdates', function (data) {
                        self._dispatchWS_roomsUpdates();
                    });
                    chat_socket.on('usersInRoomUpdates', function (data) {
                        if (data && 'updated_room_info' in data && Array.isArray(data.updated_room_info)) {
                            self._dispatchWS_usersInRoomUpdates(data.updated_room_info);
                        }
                    });
                    chat_socket.on('usersUpdates', function (data) {
                        if (data && 'updated_users' in data && Array.isArray(data.updated_users)) {
                            self._dispatchWS_usersUpdates(data.updated_users);
                        }
                    });
                    if (callbackFired) return;
                    callbackFired = true;
                    cb();
                });
                chat_socket.on('connect_failed', function(error) {
                    if (callbackFired) return;
                    callbackFired = true;
                    cb(error);
                });
                chat_socket.on('connect_error', function(error) {
                    if (callbackFired) return;
                    callbackFired = true;
                    cb(error);
                });
            },

            initialize: function (attributes, options) {
                _.extend(this, ErrorHandler);
                var self = this;
                this._usersCache = new Users.UsersCollection();
                this._usersCache.getMe = function() {
                    return self.get('me');
                };

                self._usersCache.fetchUserById(attributes.userId, function(error, result) {
                    if (result && !error) {
                        self.set('me', result.user);
                    }
                });

                var rooms = new Rooms.RoomsCollection(null, Object.assign(attributes, { usersCache: self._usersCache }));
                self.set('rooms', rooms);
                rooms.fetchAll();

                this.initializeSocket(function(error) {
                    if (error) self.handleRequestError(error);
                });
            },

            _dispatchWS_messagesUpdates: function(updated_messages) {
                var rooms = this.get('rooms');
                if (rooms) {
                    var someRoomNotFound = false;
                    var roomItems = _.map(updated_messages, function(roomInfo) {
                        var roomModel = rooms.get(roomInfo.room_id);
                        if (!roomModel) someRoomNotFound = true; // If there is no such a room, do a fallback instead of trying to merge room info
                        return { roomModel: roomModel, roomInfo: _.omit(roomInfo, 'room_id') };
                    });
                    if (someRoomNotFound) { // Fallback
                        rooms.fetchAll();
                    } else {
                        _.forEach(roomItems, function(roomItems) {
                            roomItems.roomModel.updateMessagesState(roomItems.roomInfo);
                        });
                    }
                }
            },
            _dispatchWS_roomsUpdates: function() {
                var rooms = this.get('rooms');
                if (rooms) {
                    rooms.fetchAll();
                }
            },
            _dispatchWS_usersInRoomUpdates: function(updated_room_info) {
                var rooms = this.get('rooms');
                if (rooms) {
                    var someRoomNotFound = false;
                    var roomItems = _.map(updated_room_info, function(roomInfo) {
                        var roomModel = rooms.get(roomInfo.room_id);
                        if (!roomModel) someRoomNotFound = true; // If there is no such a room, do a fallback instead of trying to merge room info
                        return { roomModel: roomModel, newUserIds: roomInfo.user_ids };
                    });
                    if (someRoomNotFound) {
                        rooms.fetchAll(); // Fallback
                    } else {
                        _.forEach(roomItems, function(roomItems) {
                            roomItems.roomModel.setUserIds(roomItems.newUserIds, function(error) {
                                if (error) {
                                    rooms.fetchAll();
                                }
                            });
                        });
                    }
                }
            },
            _dispatchWS_usersUpdates: function(updated_users) {
                if (this._usersCache) {
                    this._usersCache.add(updated_users, { merge: true });
                }
            },

            searchUsers: function(searchString, roomType, cb) {
                var self = this;
                var searchUsers = new SearchUsersCollection(null, { searchString: searchString, roomType: roomType });
                searchUsers.fetch({
                    error: function(err) {
                        self.handleRequestError(err);
                        cb(err);
                    },
                    success: function() {
                        cb(null, searchUsers);
                    }
                });
            },
        });

        return ChatModel;
    });
