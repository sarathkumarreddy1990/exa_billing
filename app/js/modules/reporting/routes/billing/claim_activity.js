define([
  'jquery'
  , 'backbone'
  , 'backbonesubroute'
  , 'modules/reporting/utils/routing'
  , 'modules/reporting/views/billing/claim_activity'
],
  function ($, Backbone, SubRoute, RoutingUtils, ClaimActivityView) {

    var ClaimActivityRouter = Backbone.SubRoute.extend({
      routes: {
        '': 'showDefaultView'
      },

      showDefaultView: function () {
        this.initializeRouter();
        this.ClaimActivityView.showForm();
      },

      initialize: function (options) {
        this.options = options;
      },

      initializeRouter: function () {
        this.options.screen = facilityModules.reportScreens.claim_activity;
        layout.initializeLayout(this);

        if (!layout.initialized) {
          RoutingUtils.clearView(this.options.currentView);
          this.ClaimActivityView = new ClaimActivityView(this.options);
          this.options.currentView = this.ClaimActivityView;
        }
      }
    });

    return ClaimActivityRouter;
  });
