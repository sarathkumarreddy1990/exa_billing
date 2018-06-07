define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/claim-inquiry'
],
    function (
        $,
        Backbone,
        SubRoute,
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
                this.options.currentView = this.claimInquiryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.claimInquiryScreen = new ClaimInquiryView(this.options);
                }
            }
        });
    });
