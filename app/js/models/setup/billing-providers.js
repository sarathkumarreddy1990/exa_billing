define(['backbone'], function (Backbone) {
    var billingProviderModels = Backbone.Model.extend({

        urlRoot: "/exa_modules/billing/setup/billing_providers",

        defaults: {
            "name": "",
            "isActive": "",
            "companyId": "",
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
            "communicationInfo": "",
            "mspExternalUrl": '',
            "mspUserName": '',
            "mspPassword": '',
            "mspLastUpdateDate": null

        },

        initialize: function (models) {
        }
    });
    return billingProviderModels;
});
