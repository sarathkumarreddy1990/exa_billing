define(['backbone'], function (Backbone) {
    var billingProviderModels = Backbone.Model.extend({

        url: "/exa_modules/billing/setup/billing_providers",

        defaults: {
            "name": "",
            "isActive": "",
            "companyID": "",
            "code": "",
            "shortDescription": "",
            "federalTaxId": "",
            "npiNo": "",
            "taxonomyCode": "",
            "contactPersonName": "",
            "addressLine1": "",
            "addressLine2": "",
            "city": "",
            "state": "",
            "zipCode": "",
            "zipCodePlus": "",
            "email": "",
            "phoneNumber": "",
            "faxNumber": "",
            "webUrl": "",
            "payToAddressLine1": "",
            "payToAddressLine2": "",
            "payToCity": "",
            "payToState": "",
            "payToZipCode": "",
            "payToZipCodePlus": "",
            "payToEmail": "",
            "payToPhoneNumber": "",
            "payToFaxNumber": "",
            "communicationInfo": ""
        },

        initialize: function (models) {
        }
    });
    return billingProviderModels;
});
