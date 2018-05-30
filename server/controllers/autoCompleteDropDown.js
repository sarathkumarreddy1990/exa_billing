const data = require('../data/autoCompleteDropDown');

module.exports = {

    getCptAutoCompleteDetails: function (query) {
        return data.getCptAutoCompleteDetails(query);
    }
};