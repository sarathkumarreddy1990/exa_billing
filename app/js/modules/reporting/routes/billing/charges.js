define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'modules/reporting/utils/routing'
    , 'modules/reporting/views/billing/charges'
],
function ($, Backbone, SubRoute, RoutingUtils, chargesView) {

    var ChargesRouter = Backbone.View.extend({
        routes: {
            '': 'showDefaultView'
        },

        showDefaultView: function () {
            console.log('router - showDefaultView');
            this.initializeRouter();
            this.chargesView.showForm();
        },

        initialize: function (options) {
            console.log('router - initialize, options: ', options);
            this.options = options;
        },

        initializeRouter: function () {
            console.log('router - initializeRouter');
            this.options.screen = facilityModules.reportScreens.charges;
            layout.initializeLayout(this);

            if (!layout.initialized) {
                RoutingUtils.clearView(this.options.currentView);
                this.chargesView = new chargesView(this.options);
                this.options.currentView = this.chargesView;
            }
        }
    });

    return ChargesRouter;
});