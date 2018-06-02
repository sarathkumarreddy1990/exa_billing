const data = require('../../data/setup/validations');

module.exports = {

    getData: function (args) {
        return data.getData(args);
    },

    createOrUpdate: async (params) => {
        return data.createOrUpdate(params);
    }

};