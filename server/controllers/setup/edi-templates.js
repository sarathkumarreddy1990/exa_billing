const ediConnect = require('../../../modules/edi/');
const data = require('../../data');

module.exports = {

    getTemplatesList: (params) => {
        return ediConnect.getTemplatesList(params.flag);
    },

    getTemplate: (params) => {
        return ediConnect.getTemplate(params.flag, params.name);
    },

    createTemplate: async (params, audit) => {
        let result = await ediConnect.createTemplate(params.flag, params.name);

        await data.createAudit({
            logDescription: `Add: New EDI Template ${params.name}`,
            ...audit
        });

        return result;
    },

    updateTemplate: async (params1, params2) => {
        let result = await  ediConnect.updateTemplate(params1.flag, params1.name, params2.templateBody);

        await data.createAudit({
            logDescription: `Update: EDI Template ${params1.name} updated`,
            ...params2
        });

        return result;
    },

    deleteTemplate: async (params, audit) => {
        let result = await  ediConnect.deleteTemplate(params.flag, params.name);

        await data.createAudit({
            logDescription: `Delete: EDI Template ${params.name} deleted`,
            ...audit
        });

        return result;
    }
};
