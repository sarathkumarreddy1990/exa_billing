const data = require('../../data/setup/billing-messages');

module.exports = {

    getData: (params) => {
        if (params.id) {
            return data.getDataById(params);
        }

        return data.getData(params);
    },

    getDataById: (params) => {
        return data.getDataById(params);
    },

    create: (params) => {
        return data.create(params);
    }
};
