define(['backbone', 'collections/app-settings'], function (Backbone, AppCollection) {
    var appServerView = Backbone.View.extend({

        initialize: function (callback) {
            var self = this;
            var qs = commonjs.getParametersByName();
            var settingsData = qs.def_session ? { def_session: qs.def_session} : {};
            new AppCollection().fetch({
                data: settingsData,
                processData: true,
                success: function (model, response) {
                    _.extend(window.app, response[0]);

                    app.study_user_settings=_.where(app.usersettings, {grid_name:'Studies'}) [0];
                    app.claim_user_settings= _.where(app.usersettings, {grid_name:'Claims'}) [0];

                    app.userID = app.userInfo.userID;

                    callback();
                }
            });
        }
    });

    return appServerView;
});
