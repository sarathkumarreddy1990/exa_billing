define([
  'jquery'
  , 'backbone'
  , 'backbonesubroute'
  , 'modules/reporting/utils/routing'
  , 'modules/reporting/views/billing/diagnosis-count'
],
  function ($, Backbone, SubRoute, RoutingUtils, diagnosisCountView) {

    var diagnosisCountRouter = Backbone.SubRoute.extend({
      routes: {
        '': 'showDefaultView'
      },

      showDefaultView: function () {
        this.initializeRouter();
        this.diagnosisCountView.showForm();
      },

      initialize: function (options) {
        this.options = options;
      },

      initializeRouter: function () {
        this.options.screen = facilityModules.reportScreens.diagnosisCount;
        layout.initializeLayout(this);

        if (!layout.initialized) {
          RoutingUtils.clearView(this.options.currentView);
          this.diagnosisCountView = new diagnosisCountView(this.options);
          this.options.currentView = this.diagnosisCountView;
        }
      }
    });

    return diagnosisCountRouter;
  });
