define([
  'backbone',
  'backbonesubroute',
  'views/worklist'
], function (Backbone, BackboneSubroute, WorklistView) {
  var AppRouter = Backbone.Router.extend({
    routes: {
      "app/worklist": "startApp"
    },

    startApp: function (subroutes) {
      if (!this.appRoute) {
        this.appRoute = new WorklistView({ el: $('#root') });
      }
    }
  });

  return {
    initialize: function() {
      var router = new AppRouter();
      Backbone.history.start();
    }
  };
})