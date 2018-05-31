const data = require('../data/autoCompleteDropDown');

module.exports = {

    getCptAutoCompleteDetails: function (query) {
        return data.getCptAutoCompleteDetails(query);
    },
    getProviders: function (query) {
        return data.getProviders(query);
    },
    getICDcodes: function (query) {
        return data.getICDcodes(query);
    }
};