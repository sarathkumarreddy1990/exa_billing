define([
    'backbone',
    'shared/permissions',
    'routes/app-router'
], function (Backbone, Permissions, AppRouter) {

    return {
        initialize: function () {

            if (!window.location.hash) {
                window.location.hash = '#billing/claim_workbench/list';
            }

            AppRouter.initialize();
            commonjs.initSessionHandler();
            
            if (app.userInfo.user_type != 'SU') {
                (new Permissions()).init();
            }

        }
    }
});
