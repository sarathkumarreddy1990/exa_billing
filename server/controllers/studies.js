const data = require('../data/studies');

module.exports = {
    
    getData: function (params) {
        params.isCount=false;
        return data.getData(params);
    },

    getDataCount: function (params) {
        params.isCount=true;
        return data.getData(params);
    },
    
    getDataByDate: function (params) {
        return data.getDataByDate(params);
    },
};
