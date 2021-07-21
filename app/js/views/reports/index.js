define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/reports/index.html'
],
    function (
        $,
        _,
        Backbone,
        ReportTemplate
    ) {
        return Backbone.View.extend({

            template: _.template(ReportTemplate),
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
