define(['backbone'], function (Backbone) {
    var UserLogModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/user_log",
        defaults: {
        },
        initialize: function (models) {
        }
    });
    return UserLogModel;
});
