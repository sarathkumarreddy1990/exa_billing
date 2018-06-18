const data = require('../../data/setup/user-log');

module.exports = {

    getData: async(params) => {

        if (params.id) {
            return await data.getDataById(params);
        }

        return await data.getData(params);
    },

    getDataById: async(params) => {
        return await data.getDataById(params);
    }
};