const data = require('../../data/setup/cas-group-codes');

module.exports = {

    getData: function (args) {
        if(args.id) {
            return data.getById(args);
        }
        
        return data.getData();
    },

    getById: async (params) => {
        return data.getById(params);
    },

    create: async (params) => {
        return data.create(params);
    },

    update: async (params) => {
        return data.update(params);
    },

    delete: async (params) => {
        return data.delete(params);
    }
};