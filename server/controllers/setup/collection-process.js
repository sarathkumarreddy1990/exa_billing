const data = require('../../data/setup/collection-process');

module.exports = {

    getData: (args) => {
        return data.getData(args);
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
