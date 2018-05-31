define(['backbone'], function (Backbone) {
    return Backbone.Collection.extend({
        url: "/exa_modules/billing/pending_payments",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
});