const data = require('../../data/setup/billing-classes');

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
    },

    update: (params) => {
        return data.update(params);
    },

    delete: (params) => {
        return data.delete(params);
    }
};
