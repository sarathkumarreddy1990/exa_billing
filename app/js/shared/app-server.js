define(['backbone', 'collections/app-settings'], function (Backbone, AppCollection) {
    var appServerView = Backbone.View.extend({

        initialize: function (callback) {
            var self = this;
            var qs = commonjs.getParametersByName();
            var settingsData = qs.def_session ? { def_session: qs.def_session } : {};
            
            new AppCollection().fetch({
                data: settingsData,
                processData: true,
                success: function (model, response) {
                    _.extend(window.app, response[0]);

                    app.study_user_settings = _.where(app.usersettings, { grid_name: 'studies' })[0];
                    app.claim_user_settings = _.where(app.usersettings, { grid_name: 'claims' })[0];
                    var sys_config = app.company.sys_config;
                    app.bodyParts = (typeof sys_config.sys_body_parts == "string") ? sys_config.sys_body_parts.split(',') : [];
                    app.priorities = (typeof sys_config.sys_priorities == "string") ? sys_config.sys_priorities.split(',') : [];
                    app.gender = (typeof sys_config.sys_gender == "string") ? sys_config.sys_gender.split(',') : [];
                    app.stat_level = app.stat_level_config.stat_level;
                    app.tat_config = app.tat_config.tat_config;
                    app.modifiers = app.modifiers.modifiers_codes;
                    app.userID = app.userInfo.userID;
                    app.companyID = app.company.id;
                    app.fileStoreId = app.company.file_store_id;
                    app.facilityID = app.userInfo.default_facility_id;
                    
                    commonjs.setAppSettingsReportQueueStatus();
                    callback();
                },
                error: function (model, response) {
                    commonjs.handleXhrError(model, response); 
                }
            });
        }
    });

    return appServerView;
});
