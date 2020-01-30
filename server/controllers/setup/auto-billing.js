const data = require('../../data/setup/auto-billing');

module.exports = {

    getAutobillingRules: data.getAutobillingRules,

    getAutobillingRule: data.getAutobillingRule,

    createAutobillingRule: data.createAutobillingRule,

    updateAutobillingRule: data.updateAutobillingRule,

    deleteAutobillingRule: data.deleteAutobillingRule,

    executeAutobillingRules: data.executeAutobillingRules,

};
