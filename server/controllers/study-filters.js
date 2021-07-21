const data = require('../data/study-filters');

module.exports = {

    getData: function (args) {
        return data.getData(args);
    }
};
