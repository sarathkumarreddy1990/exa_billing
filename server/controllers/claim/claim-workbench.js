const data = require('../../data/claim/claim-workbench');
const ediConnect = require('../../../modules/edi');
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


            // if(result.rows[0].data[0].subscriber[0].claim&&result.rows[0].data[0].subscriber[0].claim[0]){
            //     let serviceLine=result.rows[0].data[0].subscriber[0].claim[0].serviceLine;

            //     for(let i=0;i<serviceLine.length;i++){
            //         if(serviceLine[i].lineAdjudication){
            //             for(let j=0;j<serviceLine[i].lineAdjudication.length;j++){
            //                 let lineAdjudication =serviceLine[i].lineAdjudication[j];
            //                 let lineAdjustmentJson={}; 

            //                 if(lineAdjudication.lineAdjustment){
            //                     for(let k=0;k<lineAdjudication.lineAdjustment.length;k++){
            //                         let lineAdjustment=lineAdjudication.lineAdjustment[k];
            //                         lineAdjustmentJson['adjustmentGroupCode' + (k?k + 1:'')] =lineAdjustment.adjustmentGroupCode ;
            //                         lineAdjustmentJson['reasonCode' + (k?k + 1:'')] =lineAdjustment.reasonCode;
            //                         lineAdjustmentJson['monetaryAmount' + (k?k + 1:'')] =lineAdjustment.monetaryAmount;
            //                     }

            //                     serviceLine[i].lineAdjudication[j]= lineAdjustmentJson; 
            //                 }
            //             }
            //         }
            //     }
                
            // }


            
            // if(result.rows[0].subscriper_relationship=='Self'){
            //     result.rows[0].data[0].subscriber[0].patient[0].claim= result.rows[0].data[0].subscriber[0].claim;
            //     delete result.rows[0].data[0].subscriber[0].claim;
            // }

            
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
                data:result.rows[0].data 
            };
            ediResponse = await ediConnect.generateEdi('837_Template3', ediRequestJson);
        }

        return ediResponse;
    }

};