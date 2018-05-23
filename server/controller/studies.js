const data = require('../data/studies');

module.exports = {
    
    getData: function () {
        return data.getData();
    },
    
    getDataByDate: function (params) {
        return data.getDataByDate(params);
    },
};
