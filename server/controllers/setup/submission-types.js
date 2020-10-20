const {
    getData,
    getDataById,
    create,
    update,
    deleteData
 } = require('../../data/setup/submission-types');


module.exports = {
    getData: (params) => {
        if (params.id) {
            return getDataById(params);
        }

        return getData(params);
    },

    getDataById,

    create,

    update,

    deleteData
};


