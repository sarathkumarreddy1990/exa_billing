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
                    callback();
                }
            });
        }
    });

    return appServerView;
});
