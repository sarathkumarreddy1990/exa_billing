const data = require('../data/patients');


module.exports = {

    getById: async (params) => {
        return await data.getById(params);
    }

};
