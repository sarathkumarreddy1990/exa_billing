define(['backbone'], function (Backbone) {
    return Backbone.Collection.extend({
        url: "/exa_modules/billing/era/era_list",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
});