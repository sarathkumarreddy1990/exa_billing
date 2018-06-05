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
                var self = this;
                $(this.el).html(this.template());
            }
        });
    });
