define(['backbone'], function (Backbone) {
    var EDIClearingHousesModel = Backbone.Model.extend({

        url: "/exa_modules/billing/setup/edi_clearinghouses",

        defaults: {
            "name": "",
            "code": "",
            "recevier_name": "",
            "receiver_id": "",
            "receiver_name": "",
            "isActive": "",
            "communicationInfo": "",
            "company_id":""
        },

        initialize: function (models) {
        }
    });
    return EDIClearingHousesModel;
});
