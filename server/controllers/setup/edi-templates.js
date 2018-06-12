const ediConnect = require('../../../../modules/edi');
ediConnect.init('http://192.168.1.102:5581/edi/api');

module.exports = {

    getData: (params) => {
        if (params.name) {
            return ediConnect.getDataByname(params);
        }

        return ediConnect.getData(params);
    },

    getDataById: (params) => {
        return ediConnect.getDataByName(params);
    },

    create: (params) => {
        return ediConnect.create(params);
    },

    update: (params) => {
        return ediConnect.update(params);
    },

    delete: (params) => {
        return ediConnect.delete(params);
    }
};
