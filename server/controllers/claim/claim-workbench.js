const data = require('../../data/claim/claim-workbench');
const ediConnect = require('../../../modules/edi');
const _ = require('lodash');
ediConnect.init('http://192.168.1.102:5581/edi/api');

module.exports = {

    getData: function (params) {
        params.isCount=false;
        return data.getData(params);
    },

    getDataCount: function (params) {
        params.isCount=true;
        return data.getData(params);
    },

    updateClaimStatus: function (params) {
        return data.updateClaimStatus(params);
    },

    getEDIClaim: async (params) => {    
        const result = await data.getEDIClaim(params);
        let ediResponse ={};

        if (result.rows && result.rows.length) { 

            // if(result.rows[0].subscriper_relationship=='Self'){
            //     result.rows[0].data[0].subscriber[0].patient[0].claim= result.rows[0].data[0].subscriber[0].claim;
            //     delete result.rows[0].data[0].subscriber[0].claim;
            // }

            
            let data = _.map( result.rows, function (obj) {
                return obj.data[0];
            });

            let ediRequestJson ={
                'config': {
                    'ALLOW_EMPTY_SEGMENT': true
                },
                header:result.rows[0].header,
                'bht': {
                    'requestID': '1',
                    'tsCreationDate': '20180204',
                    'tsCreationTime': '0604'
                },
                data:data
            };
            ediResponse = await ediConnect.generateEdi('837_Template3', ediRequestJson);
        }

        return ediResponse;
    }

};