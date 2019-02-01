const data = require('../data/user-settings');

module.exports = {

    getGridFields: async function (params) {
        return await Promise.all([data.getGridFields(), data.getGridFieldById(params)]);
    },

    save: async function (params) {
        return await data.save(params);
    },

    updateGridSettings: async function (params) {
        return await data.updateGridSettings(params);
    }
};
