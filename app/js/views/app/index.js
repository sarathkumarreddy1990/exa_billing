define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/app/index.html'
],
    function (
        $,
        _,
        Backbone,
        AppTemplate
    ) {
        var AppView = Backbone.View.extend({
            template: _.template(AppTemplate),
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

        return AppView;
    });
