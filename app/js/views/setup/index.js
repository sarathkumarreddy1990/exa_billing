define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/index.html'
],
    function (
        $,
        _,
        Backbone,
        SetupTemplate
    ) {
        return Backbone.View.extend({
            template: _.template(SetupTemplate),
            events: {
            },

            initialize: function (options) {
                this.options = options;
            },

            render: function () {
                $(this.el).html(this.template({
                    billingRegionCode: app.billingRegionCode,
                    countryCode: app.country_alpha_3_code
                }));
            }
        });
    });
