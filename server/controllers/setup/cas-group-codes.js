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

    saveCasGroupCodes: async (params) => {
        return data.saveCasGroupCodes(params);
    },

    updateCasGroupCodes: async (params) => {
        return data.updateCasGroupCodes(params);
    },

    deleteCasGroupCodes: async (params) => {
        return data.deleteCasGroupCodes(params);
    }
};