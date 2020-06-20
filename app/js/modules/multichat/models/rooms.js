define([
        'backbone'
      , 'modules/multichat/models/messages'
      , 'modules/multichat/models/users'
      , 'modules/multichat/utils/errorHandler'
      , 'modules/multichat/utils/triggers'
    ],
    function (
        Backbone
      , MessagesCollection
      , Users
      , ErrorHandler
      , Triggers
    ) {

        var BaseRoomModel = Backbone.Model.extend({
            defaults: {
                id: 0,
                title: null,
                possessive: null,     // possible actions for me

                members: null,
                groups: [],
                messages: null,
                lastMessageId: null,
                lastMessageDt: null,

                isMinimized: null,
                isActive: null,
                isEnabled: null
            },

            initialize: function (attributes, options) {
                _.extend(this, ErrorHandler);
                this._usersCache = options.usersCache;
                this._isOpenedCallback = null;
            },

            _isOpened: function() {
                if (this._isOpenedCallback) return this._isOpenedCallback(this);
                return false;
            },

            _mergeResponse: function(roomResponse) {
                var attributes = BaseRoomModel._roomAttributesFromResponse(roomResponse);
                this.set(attributes, {merge: true});
            },

            setUserIds: function(newUserIds, cb) {
                var self = this;
                var memberModels = [];
                var finalError = null;
                if (newUserIds.length === 0) {
                    self.set('members', memberModels);
                    cb();
                }
                _.forEach(newUserIds, function(userId) {
                    self._usersCache.fetchUserById(userId, function(err, userModel) {
                        finalError = finalError || err;
                        if (userModel && !err) {
                            memberModels.push(userModel.user);
                            if (memberModels.length === newUserIds.length) {
                                self.set('members', memberModels);
                                cb(finalError);
                            }
                        }
                    });
                });
            },

            setIsOpenedCallback: function (cb) {
                // Callback should have argument (roomId) and return bool
                this._isOpenedCallback = cb;
            },

            archive: function () {
                this.trigger(Triggers.ARCHIVE_ROOM, this.get('id'));
                // RoomsCollection is expected to be subscribed on this and remove the room from itself
            },

            setTitle: function (title, cb) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id'),
                    type: 'PUT',
                    data: {title: String(title)},
                    success: function (response) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            self._mergeResponse(response.result.room);
                            if (typeof cb === 'function') {
                                cb(response);
                            }
                        } else {
                            self.handleRequestError(response);
                        }
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },

            addMemberById: function (userId, cb) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/users/' + userId,
                    type: 'PUT',
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            var room = response.result.room;
                            self.setUserIds(room.all_user_ids, function (err) {
                                if (err && this.model.collection) {
                                    this.model.collection.fetchAll();
                                }
                            });
                            self._mergeResponse(room);
                        } else {
                            self.handleRequestError(err);
                        }
                        if (typeof cb === 'function') {
                            cb(response)
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    })

            },

            removeMemberById: function (userId) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/users/' + userId,
                    type: 'DELETE',
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            if (self._usersCache.getMe().get('id') === userId) {
                                self.trigger(Triggers.LEAVE_ROOM, self.get('id'));
                            } else {
                                self._mergeResponse(response.result.room);
                                self.trigger(Triggers.REMOVE_ROOM_USER, userId)
                            }
                        } else {
                            self.handleRequestError(err);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    }
                );
            },

            update: function () {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id'),
                    type: 'GET',
                    success: function (response) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            self._mergeResponse(response.result.room);
                        } else {
                            self.handleRequestError(err);
                        }
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },

            setActiveRoom: function () {
                this.set('isActive', true);
            },

            unsetActiveRoom: function () {
                this.set('isActive', false);
            },

            addGroupById: function (groupId, cb) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/groups/' + groupId,
                    type: 'PUT',
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status == 'ok' && 'result' in response) {
                            self.set('groups', response.result);
                        } else {
                            self.handleRequestError(err);
                        }
                        if (typeof cb === 'function') {
                            cb(response)
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    })

            },

            fetchGroups: function (cb) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/groups/',
                    type: 'GET',
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status == 'ok' && 'result' in response) {
                            self.set('groups', response.result.groups);
                        } else {
                            self.handleRequestError(err);
                        }
                        if (typeof cb === 'function') {
                            cb(response)
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    })
            },
        });

        // "Static" API
        BaseRoomModel._roomAttributesFromResponse = function (roomResponse) {
            var last_message_id = (roomResponse.last_message) ? roomResponse.last_message.id : null;
            var last_message_dt = (roomResponse.last_message) ? roomResponse.last_message.dt : null;
            var attributes = {
                id: roomResponse.id
                , title: 'possessive' in roomResponse ? roomResponse.possessive.title : roomResponse.title
                , roomType: roomResponse.room_type
                , groups: roomResponse.groups
                , createdDt: roomResponse.created_dt
                , lastMessageId: last_message_id
                , lastMessageDt: last_message_dt
                , possessive: roomResponse.possessive
                , isMinimized: roomResponse.isMinimized
                , direct_user_ids: roomResponse.direct_user_ids
                , isEnabled: roomResponse.isEnabled
            };

            return attributes;
        };

        // "Static" API
        BaseRoomModel._roomModelFromResponse = function (usersCache, roomResponse) {
            var attributes = this._roomAttributesFromResponse(roomResponse);
            var roomModel = new this(attributes, {usersCache: usersCache});
            roomModel.set('members', usersCache._mergeResponse(roomResponse.users));

            return roomModel;
        };

        BaseRoomModel.addUsers = function (room, users, type, room_title, cb) {
            var self = this, room_id = room.id || 0, data = {
                users: [],
            };
            if (room_id === 0) {
                var userId = this.get('user_id');
                data.new_room_type = type;
                data.q_id = userId + Date.now();
                data.title = room_title || '';
                data.users.push(userId);
            } else {
                data.users = Object.assign([], users);
            }

            $.ajax({
                url: '/chat/rooms/' + room_id + '/users/add',
                type: 'POST',
                data: JSON.stringify(data),
                contentType: 'application/json',
                dataType: 'json',
            }).then(function (response) {
                if (response.status === 'ok') {
                    var updated_room_data = response.result.room;
                    var updated_users_data = response.result.users;
                    self.participantCollection().add(updated_users_data, {merge: true});
                    if (!_.isEmpty(room)) {
                        room.set({address_user_ids: updated_room_data.address_user_ids, fl_user_info_dirty: true});
                    } else {
                        self.roomCollection().add(response.result.room);
                    }

                    if (typeof cb === 'function') {
                        cb(response.result);
                    }
                } else {
                    var notice = room_id ? 'chat.errors.addUsers' : 'chat.errors.addRoom';
                    commonjs.showWarning(notice);
                }
            });
        };

        BaseRoomModel.ROOM_TYPE_PRIVATE = 'private';
        BaseRoomModel.ROOM_TYPE_ADHOC = 'adhoc';
        BaseRoomModel.ROOM_TYPE_GROUP = 'group';

        var MessagesRoomModel = BaseRoomModel.extend({

            initialize: function (attributes, options) {
                BaseRoomModel.prototype.initialize.call(this, attributes, options);

                var messages = new MessagesCollection(null, Object.assign(attributes, {usersCache: this._usersCache}));

                this.set('messages', messages);
            },

            initialMessagesLoad: function (cb) {
                var messages = this.get('messages');
                if (messages.isEmpty()) {
                    messages.fetchInitial(cb);
                } else {
                    messages.fetchForward(cb);
                }
            },
            forwardMessagesLoad: function(cb) {
                var messages = this.get('messages');
                messages.fetchForward(cb);
            },
            backwardMessagesLoad: function(cb) {
                var messages = this.get('messages');
                messages.fetchBackward(cb);
            },

            reloadMessages: function(){
                var self = this;
                this.get('messages').reset(null);
                this.initialMessagesLoad(function(){
                    var lastMessageId = self.get('lastMessageId');
                    if (lastMessageId) self.setUnreadMessage(lastMessageId);
                });
            },

            updateMessagesState: function(updated_messages) {
                var self = this;

                if (!this.get('isEnabled')) {
                    return;
                }

                var newUnreadCount = updated_messages.unread_count;
                this.set('lastMessageId', updated_messages.last_message_id);
                this.set('lastMessageDt', updated_messages.last_message_dt);

                if (this._isOpened() && !(this.get('isMinimized'))) {
                    this.forwardMessagesLoad(function() {
                        if (updated_messages.last_message_id) self.setUnreadMessage(updated_messages.last_message_id);
                    });
                    newUnreadCount = 0;
                } else {
                    if ("dnd" != this._usersCache.getMe().get('chat_status')) {
                        var playPromise = app.chat.beep.play();
                        if (playPromise !== null) {
                            playPromise.catch(function () {
                                app.chat.beep.play();
                            })
                        }
                    }
                }

                if (this.get('possessive').unread_count !== newUnreadCount) {
                    this.setUnreadCount(newUnreadCount);
                }

                if(this.collection){
                    this.collection.sort();
                }
            },

            setUnreadCount: function(newUnreadCount) {
                this.get('possessive').unread_count = newUnreadCount;
                this.trigger('change:possessive.unread_count', this);
                this.trigger('change:possessive', this);
            },

            postMessage: function(content, cb) {
                var self = this;

                var last_message_id = 0;
                var lastMessage = _.last(this.get('messages'));
                if (lastMessage) {
                    last_message_id = lastMessage.id;
                };
                var q_id = Date.now() + this._usersCache.getMe().get('id') + this.get('id');
                if (this._q) {
                    if (this._q.content == content) q_id = this._q.q_id;
                }
                this._q = {
                    q_id: q_id, content: content
                }
                var data = {
                    q_id: q_id,
                    last_message_id: last_message_id,
                    timestamp: Math.round(new Date().getTime() / 1000),
                    content: content
                };

                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/messages',
                    type: 'POST',
                    data: data,
                    success: function (response) {
                        if (response.status == 'ok' && response.result && response.result.messages && Array.isArray(response.result.messages)) {
                            self._q = null;
                            self.get('messages')._mergeResponse(response.result.messages);
                            cb(null, response);
                        } else {
                            self.handleRequestError(response, { errorKey: "chat.errors.postingmessage" });
                            cb(response);
                        }
                    },
                    error: function (err) {
                        self.handleRequestError(err, { errorKey: "chat.errors.postingmessage" });
                        cb(err);
                    }
                });

            },

            addFavorite: function () {
                var self = this;
                $.ajax({
                    url: '/chat/users/' + self._usersCache.getMe().get('id') + '/favorites/' + self.get('id'),
                    type: "PUT",
                    success: function (data) {
                        self.get('possessive').is_favorite = true;
                        self.trigger('change:possessive.is_favorite');
                        self.trigger('change:possessive');
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },
            deleteFavorite: function () {
                var self = this;
                $.ajax({
                    url: '/chat/users/' + self._usersCache.getMe().get('id') + '/favorites/' + self.get('id'),
                    type: "DELETE",
                    success: function (data) {
                        self.get('possessive').is_favorite = false;
                        self.trigger('change:possessive.is_favorite');
                        self.trigger('change:possessive');
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },

            setUnreadMessage: function (messageId) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/unread',
                    type: 'PUT',
                    data: {last_read_message_id: messageId},
                    success: function (response) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            self._mergeResponse(response.result.room);
                            self.setUnreadCount(response.result.room.possessive.unread_count);
                        } else {
                            self.handleRequestError(err);
                        }
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },
        });

        var SetupRoomModel = BaseRoomModel.extend({
             defaults: Object.assign({},
                 {visibilityUsers: null},
                 BaseRoomModel.defaults),

            initialize: function (attributes, options) {
                BaseRoomModel.prototype.initialize.call(this, attributes, options);
                this.url = '/chat/rooms/' + options.id;
            },

            parse: function (response) {
                if (response.status === 'ok' && 'result' in response && 'room' in response.result) {
                    this.set('members', this._usersCache._mergeResponse(response.result.room.users));
                    this.set('visibilityUsers', new Users.SetupUsersCollection(null, {id: response.result.room.id}));
                    var visibilityUsers = this.get('visibilityUsers');
                    visibilityUsers.fetch();
                    return BaseRoomModel._roomAttributesFromResponse(response.result.room);
                }
                return null;
            },

            addOrRemoveUserList: function(existedUsers, updatedUsers){
                var usersToAdd = updatedUsers.filter(function(userId){
                    return existedUsers.indexOf(userId) === -1;
                });
                var usersToRemove = existedUsers.filter(function(userId){
                    return updatedUsers.indexOf(userId) === -1;
                });
                return {add: usersToAdd, remove: usersToRemove};
            },

            updateVisibilityUsersByIds: function(users, cb) {
                var self = this;
                var existedUsers = (this.get('visibilityUsers') && this.get('visibilityUsers').models)
                    ? _.map(this.get('visibilityUsers').models, 'id')
                    : [];
                var updatedUsers = this.addOrRemoveUserList(existedUsers, users);
                self.addVisibilityUsersByIds(updatedUsers.add, function () {
                    self.removeVisibilityUsersByIds(updatedUsers.remove, cb);
                });
            },

            updateMembersByIds: function(members, cb) {
                var self = this;
                var updatedUsers = this.addOrRemoveUserList(_.map(this.get('members'), 'id'), members);
                self.addUsersByIds(updatedUsers.add, function () {
                    self.removeUsersByIds(updatedUsers.remove, cb);
                });
            },

            getVisibilityUsers: function() {
                 var self = this;
                 $.ajax({
                     url: '/chat/rooms/' + this.id + '/users/visibility',
                 })
                     .then(
                         function (response) {
                             if (response.status === 'ok') {
                                 if ('result' in response && 'users' in response.result && Array.isArray(response.result.users)) {
                                     self.set('visibilityUsers', response.result.users);
                                 }
                                 else {
                                     self.handleRequestError(err);
                                 }
                             }
                         },
                         function (err) {
                             self.handleRequestError(err);
                         }
                     );
             },

            addUsersByIds: function(users, cb) {
                if (users.length === 0) {
                    if (typeof cb === 'function') {
                        cb();
                    }
                    return;
                }

                var self = this;

                $.ajax({
                    url: '/chat/rooms/'+ this.get('id') + '/users/add',
                    type: 'POST',
                    data: JSON.stringify({users: users}),
                    contentType: 'application/json',
                    dataType: 'json',
                }).then(
                    function (response) {
                        if (response.status === 'ok' && response.result && response.result.room && response.result.room.id) {
                            cb(response.result.room.id);
                        } else {
                            self.handleRequestError(response);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            removeUsersByIds: function(users, cb) {
                if (users.length === 0) {
                    if (typeof cb === 'function') {
                        cb();
                    }
                    return;
                }

                var self = this;
                var data = {
                    users: users
                };

                $.ajax({
                    url: '/chat/rooms/'+ this.get('id') + '/users/remove',
                    type: 'POST',
                    data: JSON.stringify(data),
                    contentType: 'application/json',
                    dataType: 'json',
                }).then(
                    function (response) {
                        if (response.status === 'ok' && response.result && response.result.room && response.result.room.id) {
                            cb(response.result.room.id);
                        } else {
                            self.handleRequestError(response);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            addVisibilityUsersByIds: function (users, cb) {
                if (users.length === 0) {
                    if (typeof cb === 'function') {
                        cb({status: 'ok'});
                    }
                    return;
                }

                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/users/visibility',
                    type: 'PUT',
                    data: JSON.stringify({users: users}),
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status === 'ok'
                            && 'result' in response
                            && 'users' in response.result
                            && Array.isArray(response.result.users)
                        ) {
                            response.result.users.forEach(function(user){
                                self.get('visibilityUsers').add(user);
                            });
                            if (typeof cb === 'function') {
                                cb(response)
                            }
                        } else {
                            self.handleRequestError(null);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    })
            },

            removeVisibilityUsersByIds: function (users, cb) {
                 if (users.length === 0) {
                     if (typeof cb === 'function') {
                         cb({status: 'ok'});
                     }
                     return;
                 }

                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + self.get('id') + '/users/visibility/remove',
                    type: 'POST',
                    data: JSON.stringify({users: users}),
                    contentType: 'application/json',
                    dataType: 'json'
                }).then(
                    function (response) {
                        if (response.status === 'ok' && 'result' in response && 'users' in response.result && Array.isArray(response.result.users))  {
                            response.result.users.forEach(function(user){
                                self.get('visibilityUsers').remove(user);
                            });
                            if (typeof cb === 'function') {
                                cb(response);
                            }
                        } else {
                            self.handleRequestError(null);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                    }
                );
            },
        });

        var RoomsCollection = Backbone.Collection.extend({

            model: MessagesRoomModel,

            initialize: function (models, options) {
                _.extend(this, ErrorHandler);
                this._usersCache = options.usersCache;
                this.url = '/chat/users/' + options.userId + '/rooms';
                this.on(Triggers.ARCHIVE_ROOM, this.archiveRoom);
                this.on(Triggers.LEAVE_ROOM, function(id){
                    this.remove(id);
                })
            },

            parse: function (response) {
                var self = this;
                var roomModel;
                if (response.status == 'ok' && 'result' in response && 'rooms' in response.result && Array.isArray(response.result.rooms)) {
                    return _.map(response.result.rooms, function (roomResponse) {
                        roomModel = self.findWhere({id: roomResponse.id});

                        roomResponse.isMinimized = roomModel ? roomModel.get('isMinimized') : null;

                        return MessagesRoomModel._roomModelFromResponse(self._usersCache, roomResponse);
                    });
                }
                return null;
            },

            comparator: function(room) {
                return -new Date(room.get('lastMessageDt') || room.get('createdDt'));
            },

            archiveRoom: function(roomId) {
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + roomId,
                    type: "DELETE",
                    success: function (response) {
                        var roomsModels = self.parse(response);
                        if (roomsModels) {
                            self.set(self.parse(response), {merge: true});
                        } else {
                            self.handleRequestError(response);
                        }
                    },
                    error: function (err) {
                        self.handleRequestError(err);
                    }
                });
            },

            getPrivateRoom: function(userId, cb) {
                var self = this;

                $.ajax({
                    url: '/chat/rooms/private/' + self._usersCache.getMe().get('id') + '/' + userId,
                    type: 'GET',
                    contentType: 'application/json',
                    dataType: 'json',
                }).then(
                    function (response) {
                        if (response.status === 'ok' && response.result && response.result.room && response.result.room.id) {
                            self._addRoomFromResponse(response);
                            cb(response.result.room.id);
                        } else {
                            self.handleRequestError(response);
                            cb(null);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            createRoom: function(options, cb) {
                var self = this;
                var q_id = Date.now() + this._usersCache.getMe().get('id') + options.roomType + options.title;
                if (this.createRoom_q) {
                    if (this.createRoom_q.roomType == options.roomType && this.createRoom_q.title == options.title) q_id = this.createRoom_q.q_id;
                }
                this.createRoom_q = {
                    q_id: q_id, roomType: options.roomType, title: options.title
                };
                var data = {
                    q_id: q_id
                    , new_room_type: options.roomType
                    , title: options.title
                    , users: options.users || [this._usersCache.getMe().get('id')]
                };

                $.ajax({
                    url: '/chat/rooms/0/users/add',
                    type: 'POST',
                    data: JSON.stringify(data),
                    contentType: 'application/json',
                    dataType: 'json',
                }).then(
                    function (response) {
                        if (response.status === 'ok' && response.result && response.result.room && response.result.room.id) {
                            self._addRoomFromResponse(response);
                            self.createRoom_q = null;
                            cb(response.result.room.id);
                        } else {
                            self.handleRequestError(response);
                            cb(null);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            _addRoomFromResponse: function(response){
                this.trigger(Triggers.OPEN_ROOM, response.result.room.id);
                response.result.rooms = [response.result.room];
                this.add(this.parse(response), {merge: true});
            },

            addRooms: function(rooms){
                this.add(this.parse(rooms), {merge: true});
            },

            fetchAll: function() {
                var self = this;
                this.fetch({
                    error: function(err) {
                        self.handleRequestError(err);
                    }
                });
            }

        });

        return {RoomsCollection: RoomsCollection, SetupRoomModel: SetupRoomModel};
    });


