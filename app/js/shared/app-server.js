define(['backbone', 'collections/app-settings'], function (Backbone, AppCollection) {
    var appServerView = Backbone.View.extend({

        initialize: function (callback) {
            var self = this;
            var qs = {}; // commonjs.getParametersByName();
            var settingsData = qs.def_session ? { def_session: qs.def_session } : {};
            var studySetting = {
                default_column: 'study_dt',
                default_column_order_by: "Desc",
                default_tab: 'All_Studies',
                field_order: [1, 10, 15, 50, 65],
                grid_name: "studies"
            };
            var claimSetting = {
                default_column: 'claim_id',
                default_column_order_by: "Desc",
                default_tab: 'All_Claims',
                field_order: [1, 19, 2, 12, 22, 27, 11, 17],
                grid_name: "claims"
            };

            new AppCollection().fetch({
                data: settingsData,
                processData: true,
                success: function (model, response) {
                    _.extend(app, response[0]);
                    //app = response[0];
                    if (!app.usersettings) {
                        app.usersettings = [];
                        app.usersettings.push(studySetting);
                        app.usersettings.push(claimSetting);
                    } else if (app.usersettings.length <= 1) {
                        if (!_.where(app.usersettings, { grid_name: 'studies' }).length) {
                            app.usersettings.push(studySetting)
                        }

                        if (!_.where(app.usersettings, { grid_name: 'claims' }).length) {
                            app.usersettings.push(claimSetting)
                        }
                    }

                    app.study_user_settings = _.where(app.usersettings, { grid_name: 'studies' })[0];
                    app.claim_user_settings = _.where(app.usersettings, { grid_name: 'claims' })[0];
                    app.default_study_tab = app.study_user_settings.default_tab;
                    app.default_claim_tab = app.claim_user_settings.default_tab;
                    var sys_config = app.company.sys_config;
                    app.bodyParts = (typeof sys_config.sys_body_parts == "string") ? sys_config.sys_body_parts.split(',') : [];
                    app.priorities = (typeof sys_config.sys_priorities == "string") ? sys_config.sys_priorities.split(',') : [];
                    app.gender = (typeof sys_config.sys_gender == "string") ? sys_config.sys_gender.split(',') : [];
                    app.stat_level = app.stat_level_config.stat_level;
                    app.tat_config = app.tat_config.tat_config;
                    app.userID = app.userInfo.userID;
                    app.companyID = app.company.id;
                    app.fileStoreId = app.company.file_store_id;
                    app.facilityID = app.userInfo.default_facility_id;
                    app.default_facility_id = app.userInfo.default_facility_id;

                    if (app.userInfo.user_settings) {
                        app.sessionTimeout = app.userInfo.user_settings.sessionInterval || app.sessionTimeout;
                        app.sessionTimeout = parseInt(app.sessionTimeout);
                    }

                    app.customStudyStatus = [];
                    app.customOrderStatus = [];

                    if (Array.isArray(app.custom_study_status)) {
                        app.custom_study_status.forEach(function (status) {
                            if (status.order_related === true) {
                                app.customOrderStatus.push(status);
                            }
                            else {
                                app.customStudyStatus.push(status);
                            }
                        });
                    }

                    _.extend(window.app, app);

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
