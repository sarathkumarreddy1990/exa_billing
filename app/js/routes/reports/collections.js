define
([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/reports/collections'
],
  function(
      $,
      Backbone,
      SubRoute,
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
              self.options.currentView = self.collectionScreen;
              layout.initializeLayout(this);

              if(!layout.initialized){
                  self.collectionScreen = new CollectionsView(self.options);
              }
          }
      });
  });
