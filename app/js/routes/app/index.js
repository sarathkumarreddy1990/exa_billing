define([
    'backbone',
    'backbonesubroute',
    'views/app/index',
    'text!templates/access-denied.html',
    'routes/app/studies'
], function (
    Backbone,
    BackboneSubroute,
    AppView,
    AccessDeniedTemplate,
    StudiesRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "studies2/*subroute": "startStudies"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                // createTrailingSlashRoutes: true, layout: siteLayouts.facility, outerLayout: null, module: facilityModules.setup, screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startStudies: function (subroute) {
                if (this.checkLicense('Studies') && !this.studiesRouter) {
                    this.defaultArgs.routePrefix = 'app/studies2/';
                    this.studiesRouter = new StudiesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                if (!this.appView) {
                    this.appView = new AppView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.appView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },

            closeRoutes: function () {
                this.studiesRouter = null;
            }
        });
    });
