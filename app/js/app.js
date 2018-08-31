define([
    'backbone',
    'routes/app-router',
    'text!templates/about.html'
], function (Backbone, AppRouter, AboutTemplate) {

    return {
        initialize: function () {

            if (!window.location.hash) {
                window.location.hash = '#billing/claim_workbench/list';
            }

            AppRouter.initialize();
            commonjs.initSessionHandler();

            commonjs.AboutTemplate = AboutTemplate;

            if (app.userInfo.user_type != 'SU') {
                window.appRights.init();
            }

        }
    }
});
