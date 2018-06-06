define([
  'jquery',
  'backbone',
  'backbonesubroute',
  'views/reports/claim-activity'
],
  function (
      $,
      Backbone,
      SubRoute,
      ClaimActivityView
  ) {
      return Backbone.SubRoute.extend({
          routes: {
              'claim-activity': 'showDefaultView'
          },

          showDefaultView: function () {
              this.initializeRouter();
              this.claimActivityScreen.showForm();
          },

          initialize: function (options) {
              this.options = options;
          },

          initializeRouter: function () {
              this.options.screen = facilityModules.reportScreens.claimActivity;
              this.options.currentView = this.claimActivityScreen;
              layout.initializeLayout(this);

              if (!layout.initialized) {
                  this.claimActivityScreen = new ClaimActivityView(this.options);
              }
          }
      });
  });
