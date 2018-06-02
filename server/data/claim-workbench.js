const SearchFilter = require('./claim-search-filters');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    }
};
