const data = require('../../data/era/index');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    },
    
    checkERAFileIsProcessed: function (fileMd5) {
        return data.checkERAFileIsProcessed(fileMd5);
    },

    saveERAFile: function (params) {
        return data.saveERAFile(params);
    },
    
    getFileStorePath: function (params) {
        return data.getFileStorePath(params);
    }
};
