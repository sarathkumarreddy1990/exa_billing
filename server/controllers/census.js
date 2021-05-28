const data = require('../data/census');

module.exports = {

    getData: (params) => {
        return data.getData(params);
    }
};
