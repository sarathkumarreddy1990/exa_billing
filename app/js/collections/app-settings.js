define(['backbone'], function (Backbone) {
    var appsettings = Backbone.Collection.extend({

        url: '/exa_modules/billing/app_settings',

        initialize: function () {
        },

        parse: function (response) {
            return response;
        }
    });

    return appsettings;
});
