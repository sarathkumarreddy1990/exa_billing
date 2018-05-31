const data = require('../../data/setup/adjustment_codes');

module.exports = {

    getData: (params) => {
        return data.getData(params);
    },

    getDataById: (params) => {
        return data.getDataById(params);
    },

    createAdjustment: (params) => {
        return data.createAdjustment(params);
    },

    updateAdjustment: (params) => {
        return data.updateAdjustment(params);
    },

    deleteAdjustment: (params) => {
        return data.deleteAdjustment(params);
    }
};
