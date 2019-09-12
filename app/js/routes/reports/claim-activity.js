define([
  'jquery',
  'backbone',
  'backbonesubroute',
  'shared/routing',
  'views/reports/claim-activity'
],
  function (
      $,
      Backbone,
      SubRoute,
      RoutingUtils,
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
              layout.initializeLayout(this);

              if (!layout.initialized) {
                  RoutingUtils.clearView(this.options.currentView);
                  this.options.currentView = this.claimActivityScreen = new ClaimActivityView(this.options);
              }
          }
      });
  });
