const data = require('../../data/setup/study-filter');

module.exports = {
    save: async function (params) {
        return await data.save(params);
    }
};