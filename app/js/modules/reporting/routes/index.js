define([
     'backbone'
    ,'backbonesubroute'
    , 'modules/reporting/routes/billing/charges'
],
 function (
    Backbone
    , BackboneSubroute 
    , chargesRoute
 ){
  var reportingRouter = Backbone.View.extend({
      routes: {
        'billing/charges': 'startCharges'
      },
      startCharges: function (subroute) {
        if (this.checkLicense(facilityModules.reportScreens.charges) && !this.chargesRoute) {
          this.defaultArgs.routePrefix = 'reports/billing/charges';
          this.chargesRoute = new chargesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
        }
      }
    });
    return reportingRouter;
 });