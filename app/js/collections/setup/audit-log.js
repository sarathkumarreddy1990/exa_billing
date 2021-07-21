define(['backbone', 'models/setup/audit-log'], function (Backbone, auditLogModel) {
    var AuditLogList = Backbone.Collection.extend({
        model: auditLogModel,
        url: "/exa_modules/billing/setup/audit_log",
        initialize: function () {
        },
        parse: function (response) {
            return response
        }
    });
    return AuditLogList;
});
