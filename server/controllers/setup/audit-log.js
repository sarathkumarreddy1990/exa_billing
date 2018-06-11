const data = require('../../data/setup/audit-log');

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