define([
    'backbone',
    'backbonesubroute',
    'views/reports/index',
    'text!templates/access-denied.html',
    'routes/reports/charges'
], function (
    Backbone,
    BackboneSubroute,
    ReportView,
    AccessDeniedTemplate,
    ChargeReportRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "r/*subroute": "startChargesReport"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                //createTrailingSlashRoutes: true, layout: siteLayouts.report, outerLayout: null, module: facilityModules.report, screen: null, el: '#data_container', routePrefix: null
                createTrailingSlashRoutes: true, layout: 'report', outerLayout: null, module: 'report', screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startChargesReport: function (subroute) {
                if (this.checkLicense('Charges') && !this.chargesRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.chargesRouter = new ChargeReportRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                //this.options = options;
                if (!this.reportView) {
                    this.reportView = new ReportView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.reportView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },
        });
    });
