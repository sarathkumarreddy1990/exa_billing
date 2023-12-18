define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'shared/routing',
    'views/reports/collections'
],
  function(
      $,
      Backbone,
      SubRoute,
      RoutingUtils,
      CollectionsView
  ) {
      return Backbone.SubRoute.extend({
          routes: {
              'collections' : 'showDefaultView'
          },

          showDefaultView: function () {
            this.initializeRouter();
            this.collectionScreen.showForm();
        },

          initialize: function(options){
              this.options = options;
          },

          initializeRouter: function(){
              var self = this;
              self.options.screen = facilityModules.reportScreens.collections;
              layout.initializeLayout(this);

              if(!layout.initialized){
                  RoutingUtils.clearView(this.options.currentView);
                  self.collectionScreen = new CollectionsView(self.options);
                  self.options.currentView = self.collectionScreen;
              }
          }
      });
  });
