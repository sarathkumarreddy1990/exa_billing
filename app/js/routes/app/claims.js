define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/claims/claim-workbench',
    'shared/paper-claim'
],
    function (
        $,
        Backbone,
        SubRoute,
        claimWorkbenchView,
        PaperClaim
    ) {
        var StudiesRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                ':id': 'showInvoiceReport'
            },

            showGrid: function () {
                this.initializeRouter();
                this.claimWorkbenchScreen.render();
            },

            showInvoiceReport: function (invoiceNo) {                
                var paperClaim = new PaperClaim();
                paperClaim.print('direct_invoice', [1], false, {
                    sortBy: 'service_date',
                    invoiceNo: invoiceNo,
                    showInline: true
                });
                $('.navbar').hide();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "ClaimWorkbench";//facilityModules.setupScreens.icd;
                this.options.currentView = this.claimWorkbenchScreen;
                this.options.module = "Claims";
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    this.claimWorkbenchScreen = new claimWorkbenchView(this.options);
                }
            }
        });

        return StudiesRouter;
    });
