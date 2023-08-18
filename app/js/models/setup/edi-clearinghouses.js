define(['backbone'], function (Backbone) {
    var EDIClearingHousesModel = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/edi_clearinghouses",

        defaults: {
            "name": "",
            "code": "",
            "recevier_name": "",
            "receiver_id": "",
            "receiver_name": "",
            "ediTemplateName": "",
            "ediFileExtension": "",
            "eraFileExtension": "",
            "isActive": "",
            "communicationInfo": "",
            "company_id":""
        },

        initialize: function () {
        }
    });
    return EDIClearingHousesModel;
});
