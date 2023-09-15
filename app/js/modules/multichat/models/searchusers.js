define([
        'backbone'
      , 'modules/multichat/models/users'
      , 'modules/multichat/utils/errorHandler'
    ],
    function (
        Backbone
      , Users
      , ErrorHandler
    ) {

        var SearchUserModel = Users.UserModel.extend({
            defaults: {
                id: null,
                user_full_name: null,
                chat_status: null
            }
        });

        var SearchUsersCollection = Backbone.Collection.extend({

            model: SearchUserModel,

            initialize: function (models, options) {
                _.extend(this, ErrorHandler);
                this.url = '/chat/users/search?' + $.param({ name_substring: options.searchString, room_type: options.roomType });
            },

            parse: function (response) {
                if (response.status == 'ok' && 'result' in response && 'users' in response.result && Array.isArray(response.result.users)) {
                    return _.map(response.result.users, function (userResponse) {
                        return new SearchUserModel(userResponse);
                    });
                }
                return null;
            }
        });

        return SearchUsersCollection;
    });


