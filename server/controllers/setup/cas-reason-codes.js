const data = require('../../data/setup/cas-reason-codes');

module.exports = {

    getData: (params) => {
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
