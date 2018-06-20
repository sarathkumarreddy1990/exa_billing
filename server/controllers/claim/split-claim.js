const data = require('../../data/claim/split-claim');

module.exports = {
    getData: (params) => {
        return data.getData(params);
    },

    createClaim: (params) => {
        return data.createClaim(params);
    },

    getvalidatedData: (params) => {
        return data.getvalidatedData(params);
    },
};