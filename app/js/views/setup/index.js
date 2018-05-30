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
        homeTemplate
    ) {
        var SetupView = Backbone.View.extend({
            template: _.template(homeTemplate),
            events: {
            },

            initialize: function (options) {
                this.options = options;
            },

            render: function () {
                var self = this;
                $(this.el).html(this.template());
            }
        });

        return SetupView;
    });
