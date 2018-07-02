const data = require('../../data/claim-filters');

module.exports = {

    getData: function (args) {
        return data.getData(args);
    }
};
