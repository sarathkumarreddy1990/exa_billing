const data = require('../../data/setup/provider-id-codes');

module.exports = {

    getData: function (args, params) {
        if (args.id) {
            args.provider_id = params.provider_id;
            return data.getById(args);
        }
        else if(args.provider_id) {
            return data.getData(args);
        }
        
        return data.getData(params);
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
