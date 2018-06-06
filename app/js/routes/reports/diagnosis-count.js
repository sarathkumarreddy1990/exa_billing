define([
  'jquery',
  'backbone',
  'backbonesubroute',
  'views/reports/diagnosis-count'
],
  function (
    $,
    Backbone,
    SubRoute,
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
        this.options.currentView = this.diagnosisCountScreen;
        layout.initializeLayout(this);

        if (!layout.initialized) {
          this.diagnosisCountScreen = new DiagnosisCountView(this.options);
        }
      }
    });
  });
