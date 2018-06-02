const SearchFilter = require('./search-filter');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    }
};
