define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/claim-inquiry'
],
    function (
        $,
        Backbone,
        SubRoute,
        RoutingUtils,
        ClaimInquiryView
    ) {
        return Backbone.SubRoute.extend({
            routes: {
                'claim-inquiry': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.claimInquiryScreen.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.claimInquiry;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.options.currentView = this.claimInquiryScreen = new ClaimInquiryView(this.options);
                }
            }
        });
    });
