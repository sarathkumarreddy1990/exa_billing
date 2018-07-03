const ediConnect = require('../../../modules/edi/');

module.exports = {

    getTemplatesList: (params) => {
        return ediConnect.getTemplatesList(params.flag);
    },

    getTemplate: (params) => {
        return ediConnect.getTemplate(params.flag, params.name);
    },

    createTemplate: (params) => {
        return ediConnect.createTemplate(params.flag, params.name);
    },

    updateTemplate: (params1, params2) => {

        return ediConnect.updateTemplate(params1.flag, params1.name, params2.templateBody);
    },

    deleteTemplate: (params) => {
        return ediConnect.deleteTemplate(params.flag, params.name);
    }
};
