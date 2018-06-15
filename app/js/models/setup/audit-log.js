define(['backbone'], function (Backbone) {
    var AuditLogModel = Backbone.Model.extend({
        url: "/exa_modules/billing/setup/audit_log",
        defaults: {
        },
        initialize: function (models) {
        }
    });
    return AuditLogModel;
});
