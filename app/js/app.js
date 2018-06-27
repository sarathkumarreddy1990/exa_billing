define([
    'backbone',
    'routes/app-router'
], function (Backbone, AppRouter) {

    return {
        initialize: function () {

            if (!window.location.hash) {
                window.location.hash = '#billing/claim_workbench/list';
            }

            AppRouter.initialize();
            commonjs.initSessionHandler();
            commonjs.initPermissionHandler();
        }
    }
});
