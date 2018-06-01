define([
        'jquery'
        , 'backbone'
        , 'backbonesubroute'
        , 'modules/reporting/utils/routing'
        , 'modules/reporting/views/billing/referring-provider-count'
    ],
    function ($, Backbone, SubRoute, RoutingUtils, ReferringProviderCountView) {

        return Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.referringProviderCountView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.referringProviderCount;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.referringProviderCountView = new ReferringProviderCountView(this.options);
                    this.options.currentView = this.referringProviderCountView;
                }
            }
        });
    });
