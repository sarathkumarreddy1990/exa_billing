const data = require('../../data/setup/insurance-x12-mapping');

module.exports = {

    getData: function (args) {
        if (args.id) {
            return data.getById(args);
        }

        return data.getData(args);
    },

    getById: async (params) => {
        return data.getById(params);
    },


    update: async (params) => {
        return data.update(params);
    },

};
