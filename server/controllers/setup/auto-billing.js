const data = require('../../data/setup/auto-billing');

module.exports = {

    getAutobillingRules: (params) => {
        return data.getAutobillingRules(params);
    },

    getAutobillingRule: (params) => {
        return data.getAutobillingRule(params);
    },

    createAutobillingRule: (params) => {
        return data.createAutobillingRule(params);
    },

    updateAutobillingRule: (params) => {
        return data.updateAutobillingRule(params);
    },

    deleteAutobillingRule: (params) => {
        return data.deleteAutobillingRule(params);
    },

    executeAutobillingRules: data.executeAutobillingRules,

};
