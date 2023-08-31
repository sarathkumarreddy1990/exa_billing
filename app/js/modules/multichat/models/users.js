define([
        'jquery'
      , 'backbone'
      , 'modules/multichat/utils/errorHandler'
    ],
    function (
        $
      , Backbone
      , ErrorHandler
    ) {

        var UserModel = Backbone.Model.extend({
            defaults: {
                id: null,
                user_full_name: null,
                chat_status: null,
                possessive: null      // expected to exist only for me
            },
            initialize: function (attributes, options) {
                _.extend(this, ErrorHandler);
            },

            setStatus: function(status) {
                var self = this;
                var current_status = self.get('chat_status');

                $.ajax({
                    url: '/chat/users/' + self.get('id') + '/status/' + status,
                    type: 'PUT',
                    success: function (response) {
                        if (response.status === 'ok') {
                            self.set('chat_status', response.result.chat_status);
                        } else {
                            self.set('chat_status', current_status);
                            self.handleRequestError(err);
                        }
                    },
                    error: function (err, response) {
                        self.set('chat_status', current_status);
                        self.handleRequestError(err);
                    }
                });
            },

            getInitials: function () {
                var name = this.get('user_full_name');
                var namesArray = name.split(',');
                var initials = '';
                if (namesArray[1]) {
                    var firstName = this.extractInitial(namesArray[1]);
                    var lastName = this.extractInitial(namesArray[0]);

                    initials = firstName + lastName;
                }
                else {
                    initials = this.extractInitial(name);
                }

                return initials !== '' ? initials : "?";
            },

            extractInitial: function (name) {
                if (name.match(/\b\w/g)) {
                    return name.match(/\b\w/g).join('');
                }

                if (name.match(/\S/g)) {
                    return name.match(/\S/g)[0];
                }

                return "";
            },
        });

        var UsersCollection = Backbone.Collection.extend({

            model: UserModel,

            initialize: function (attributes) {
                _.extend(this, ErrorHandler);
            },

            _loadUserById: function(userId, cb) {
                var self = this;
                $.ajax({
                    url: '/chat/users/' + userId
                })
                .then(
                    function (response) {
                        if (response.status === 'ok') {
                            if ('result' in response && Array.isArray(response.result)) {
                                var userAttribs = response.result[0];  // Backend returns the same object structure as UserModel requires
                                var userModel = self.add(userAttribs, { merge: true });
                                cb(null, { user: userModel });
                            }
                            else {
                                self.handleRequestError(err);
                                cb(response);
                            }
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            _mergeResponse: function(usersResponse) {
                return this.add(usersResponse, { merge: true });
            },

            getMe: function() {
                // Stub
            },

            fetchUserById: function (userId, cb) {
                var cached = this.get(userId);
                if (cached) {
                    cb(null, {user: cached});
                } else {
                    this._loadUserById(userId, function (error, result) {
                        cb(error, result);
                    });
                }
            },

            searchUsers: function (searchString, roomType, cb) {
                var self = this;
                $.ajax({
                    url: '/chat/users/search',
                    data: {name_substring: searchString, room_type: roomType}
                })
                    .then(function (response) {
                        if (response.status === 'ok') {
                            self.reset();
                            self.add(response.result.users);
                            if (typeof cb === 'function') {
                                cb();
                            }
                        }
                    });
            }
        });

        var VisibilityUserModel = Backbone.Model.extend({
            idAttribute: 'user_id',
            defaults: {
                user_id: null,
                user_full_name: null
            },

            initialize: function() {
                _.extend(this, ErrorHandler);
            },
        });

        var VisibilityUsersCollection = Backbone.Collection.extend({

            model: VisibilityUserModel,

            initialize: function (models, options) {
                _.extend(this, ErrorHandler);
                this.url = '/chat/rooms/' + options.id + '/users/visibility';
            },

            parse: function (response) {
                if (
                    'result' in response
                    && 'users' in response.result
                    && Array.isArray(response.result.users)
                    && response.result.users.length > 0
                ) {
                    return response.result.users;
                }
                return null;
            },

        });

        return { UserModel: UserModel, UsersCollection: UsersCollection, SetupUsersCollection: VisibilityUsersCollection };
    });


