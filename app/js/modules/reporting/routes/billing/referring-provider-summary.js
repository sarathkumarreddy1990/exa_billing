define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/referring-provider-summary'
],
    function ($, Backbone, SubRoute, RoutingUtils, referringProviderSummaryView) {

        return Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.referringProviderSummaryView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.referringProviderSummary;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.referringProviderSummaryView = new referringProviderSummaryView(this.options);
                    this.options.currentView = this.referringProviderSummaryView;
                }
            }
        });
    });
