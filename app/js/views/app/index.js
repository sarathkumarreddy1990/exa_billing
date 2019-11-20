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
                $(this.el).html(this.template());
                this.regionalLayoutChanges();
            },

            // Adds and removes region-specific UI/DOM elements (primarily ones in the .pug files)
            regionalLayoutChanges: function () {
                if (app.billingRegionCode === 'can_AB') {
                    $(".aEDITemplate").remove();
                }
            }
        });

        return AppView;
    });
