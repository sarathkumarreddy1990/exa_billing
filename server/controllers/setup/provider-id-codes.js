const data = require('../../data/setup/provider-id-codes');

module.exports = {

    getData: function (args, params) {
        if (args.id) {
            args.provider_id = params.provider_id;
            return data.getById(args);
        }
        
        return data.getData(args);
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