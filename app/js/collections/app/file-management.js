define(['backbone'], function (Backbone) {
    var filesList = Backbone.Collection.extend({
        url: '/exa_modules/billing/ohip/fileManagement'
    });
    return filesList;
});
