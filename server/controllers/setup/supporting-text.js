const data = require('../../data/setup/supporting-text');

module.exports = {

    labelCpts: data.labelCpts,

    labelModifiers: data.labelModifiers,

    autocompleteCpts: data.autocompleteCpts,

    autocompleteModifiers: data.autocompleteModifiers,

    findRelevantTemplates: data.findRelevantTemplates,

    getDataById: data.getDataById,

    getData: (params) => {
        if (params.id) {
            return data.getDataById(params);
        }

        return data.getData(params);
    },

    create: data.create,

    update: data.update,

    delete: data.delete

};
