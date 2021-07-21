define(['backbone', 'models/setup/user-log'], function (Backbone, userLogModel) {
    var UserLogList = Backbone.Collection.extend({
        model: userLogModel,
        url: "/exa_modules/billing/setup/user_log",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return UserLogList;
});
