const data = require('../data/claims');

module.exports = {
    
    getLineItemsDetails: function (params) {
        return data.getLineItemsDetails(params);
    }
};
