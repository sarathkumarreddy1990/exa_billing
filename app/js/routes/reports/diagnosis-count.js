define([
  'jquery',
  'backbone',
  'backbonesubroute',
  'shared/routing',
  'views/reports/diagnosis-count'
],
  function (
    $,
    Backbone,
    SubRoute,
    RoutingUtils,
    DiagnosisCountView
  ) {
    return Backbone.SubRoute.extend({
      routes: {
        'diagnosis-count': 'showDefaultView'
      },

      showDefaultView: function () {
        this.initializeRouter();
        this.diagnosisCountScreen.showForm();
      },

      initialize: function (options) {
        this.options = options;
      },

      initializeRouter: function () {
        this.options.screen = facilityModules.reportScreens.diagnosisCount;
        layout.initializeLayout(this);

        if (!layout.initialized) {
          RoutingUtils.clearView(this.options.currentView);
          this.options.currentView = this.diagnosisCountScreen = new DiagnosisCountView(this.options);
        }
      }
    });
  });
