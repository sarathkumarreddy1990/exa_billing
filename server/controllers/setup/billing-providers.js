const data = require('../../data/setup/billing-providers');

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

    save: async (params) => {
        return data.save(params);
    },

    update: async (params) => {
        return data.update(params);
    },

    delete: async (params) => {
        return data.delete(params);
    }
};