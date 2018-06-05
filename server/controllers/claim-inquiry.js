const data = require('../data/claim-inquiry');

module.exports = {
    getData: (params)=>{
        return data.getData(params);
    }
};
