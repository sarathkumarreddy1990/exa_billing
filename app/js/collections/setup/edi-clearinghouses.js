define(['backbone','models/setup/edi-clearinghouses'], function (Backbone,ediClearinghousesModel) {

    var ediClearingHousesList = Backbone.Collection.extend({
        model: ediClearinghousesModel,
        url: "/exa_modules/billing/setup/edi_clearinghouses",

        initialize: function () {
        },

        parse: function (response) {
            return response
        }

    });
    return ediClearingHousesList;
});