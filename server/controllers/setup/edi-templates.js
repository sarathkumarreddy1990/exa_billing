const ediConnect = require('../../../../modules/edi');
ediConnect.init('http://192.168.1.102:5581/edi/api');

module.exports = {

    getTemplatesList: (params) => {
        if (params.name) {
            return ediConnect.getTemplate(params.name, params.flag);
        }

        return ediConnect.getTemplatesList(params.flag);
    },

    getTemplate: (params) => {
        return ediConnect.getTemplate(params.name);
    },

    createTemplate: (params) => {
        return ediConnect.createTemplate(params.flag, params.name);
    },

    updateTemplate: (params) => {
        return ediConnect.updateTemplate(params.flag, params.name, params.tempBody);
    },

    deleteTemplate: (params) => {
        return ediConnect.deleteTemplate(params.flag, params.name);
    }
};
