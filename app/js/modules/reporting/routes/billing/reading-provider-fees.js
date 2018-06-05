define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/reading-provider-fees'
],
function ($, Backbone, SubRoute, RoutingUtils, readingProviderFeesView) {

    var ReadingProviderFeesRouter = Backbone.SubRoute.extend({
        routes: {
            '': 'showDefaultView'
        },

        showDefaultView: function () {
            console.log('router - showDefaultView');
            this.initializeRouter();
            this.readingProviderFeesView.showForm();
        },

        initialize: function (options) {
            console.log('router - initialize, options: ', options);
            this.options = options;
        },

        initializeRouter: function () {
            console.log('router - initializeRouter');
            this.options.screen = facilityModules.reportScreens.readingProviderFees;
            layout.initializeLayout(this);

            if (!layout.initialized) {
                RoutingUtils.clearView(this.options.currentView);
                this.readingProviderFeesView = new readingProviderFeesView(this.options);
                this.options.currentView = this.readingProviderFeesView;
            }
        }
    });

    return ReadingProviderFeesRouter;
});