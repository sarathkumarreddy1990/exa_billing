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
                    var sys_config = commonjs.hstoreParse(response[0].sys_config);
                    app.bodyParts = (typeof sys_config.sys_body_parts == "string") ? sys_config.sys_body_parts.split(',') : [];
                    app.priorities = (typeof sys_config.sys_priorities == "string") ? sys_config.sys_priorities.split(',') : [];
                    app.stat_level = app.stat_level_config.stat_level;
                    app.tat_level = app.tat_config.tat_config;
                    callback();
                }
            });
        }
    });

    return appServerView;
});
