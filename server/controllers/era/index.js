const data = require('../../data/era/index');

module.exports = {

    getEraFiles: function (params) {
        return data.getEraFiles(params);
    }
};
