define([
    'backbone',
    'routes/app.router'
], function (Backbone, AppRouter) {

    return {
        initialize: function () {

            if (!window.location.hash) {
                window.location.hash = '#app/worklist';
            }

            AppRouter.initialize();
        }
    }
});
