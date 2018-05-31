define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/claim_inquiry'
],
    function ($, Backbone, SubRoute, RoutingUtils, claimInquiryView) {

        var claimInquiryRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.claimInquiryView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.claim_inquiry;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.claimInquiryView = new claimInquiryView(this.options);
                    this.options.currentView = this.claimInquiryView;
                }
            }
        });

        return claimInquiryRouter;
    });
