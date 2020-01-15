const data = require('../../data/setup/supporting-text');

module.exports = {

    labelCpts: (params) => {
        return data.labelCpts(params);
    },

    labelModifiers: (params) => {
        return data.labelModifiers(params);
    },

    autocompleteCpts: (params) => {
        return data.autocompleteCpts(params);
    },

    autocompleteModifiers: (params) => {
        return data.autocompleteModifiers(params);
    },

    findRelevantTemplates: (params) => {
        return data.findRelevantTemplates(params);
    },

    getDataById: (params) => {
        return data.getDataById(params);
    },

    getData: (params) => {
        if (params.id) {
            return data.getDataById(params);
        }

        return data.getData(params);
    },

    create: (params) => {
        return data.create(params);
    },

    update: (params) => {
        return data.update(params);
    },

    delete: (params) => {
        return data.delete(params);
    }

};
