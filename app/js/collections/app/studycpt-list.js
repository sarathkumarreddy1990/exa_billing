define(['backbone'], function (Backbone) {
    return Backbone.Collection.extend({
        url: "/exa_modules/billing/payments/study_cpt_details",
        initialize: function () {
        },
        parse: function (response) {
            return response;
        }
    });
});
