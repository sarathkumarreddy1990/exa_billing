const data = require('../../data/setup/billing-messages');

module.exports = {

    getData: (params) => {
        return data.getData(params);
    },

    create: (params) => {
        return data.create(params);
    }
};
