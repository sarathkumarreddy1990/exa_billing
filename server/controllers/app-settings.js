const data = require('../data/app-settings');

module.exports = {
    getData: function (params) {
        return data.getData(params);
    }
};
