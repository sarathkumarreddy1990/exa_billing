define([
    'jquery',
    'backbone',
    'backbonesubroute',
    'views/setup/audit-log'
],
    function ($, Backbone, SubRoute, AuditLogView) {
        var AuditLogRouter = Backbone.SubRoute.extend({
            routes: {
                'list': 'showGrid',
                'view/:id': 'showDetails'
            },

            showGrid: function () {
                this.initializeRouter();
                this.auditLogScreen.showGrid();
            },
            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = "Audit Log";
                this.options.currentView = this.auditLogScreen;
                layout.initializeLayout(this);
                if (!layout.initialized) {
                    this.auditLogScreen = new AuditLogView(this.options);
                }
            },

            showDetails: function (id) {
                this.initializeRouter();
                this.auditLogScreen.showDetails(id);
            }
        });
        return AuditLogRouter;
    });
