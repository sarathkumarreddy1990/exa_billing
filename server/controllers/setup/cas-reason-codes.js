const data = require('../../data/setup/cas-reason-codes');

module.exports = {

    getData: (params) => {
        if (params.id) {
            return data.getDataById(params);
        }

        let {
            filterCol,
            filterData
        } = params;

        filterCol = JSON.parse(filterCol);
        filterData = JSON.parse(filterData);

        filterCol.map(function (col, index) {
            params[col] = filterData[index];
        });

        return data.getData(params);
    },

    getDataById: (params) => {
        return data.getDataById(params);
    },

    create: (params) => {
        return data.create(params);
    },

    update: (params) => {
        return data.update(params);
    },

    delete: (params) => {
        return data.delete(params);
    }
};
