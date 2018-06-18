const data = require('../../data/setup/study-filter');

module.exports = {
    save: async function (params) {
        return await data.save(params);
    },

    get: async function (args) {
        if (args.id) {
            return await data.getById(args);
        }
        
        return await data.get(args);
    },

    delete: async function (args) {
        return await data.delete(args);
    }
};