const data = require('../../data/setup/cas-group-codes');

module.exports = {
    
    getData: function () {
        return data.getData();
    },

    getById : async (params) =>{
        return data.getById(params);
    }
};