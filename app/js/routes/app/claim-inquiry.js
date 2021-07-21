define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/claims/claim-inquiry'
],
    function (
        $,
        Backbone,
        SubRoute,
        claimInquiryView
    ) {
        var claimInquiryRouter = Backbone.SubRoute.extend({
            routes: {
                ":id": "showForm",
                ":id/:isFrom/:editOff": "showForm"
            },

            showForm: function (id, isFrom, editOff) {
                this.initializeRouter();
                this.claimInquiryScreen.render({
                    claim_id: id,
                    source: isFrom,
                    editOff: editOff
                });
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "claimInquiry";
                this.options.currentView = this.claimInquiryScreen;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.claimInquiryScreen = new claimInquiryView(this.options);
                }
            }
        });

        return claimInquiryRouter;
    });