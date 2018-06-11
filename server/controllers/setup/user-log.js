const data = require('../../data/setup/adjustment-codes');

module.exports = {

    getData: (params) => {

        if (params.id) {
            return data.getDataById(params);
        }

        return data.getData(params);
    },

    getDataById: (params) => {
        return data.getDataById(params);
    }
}