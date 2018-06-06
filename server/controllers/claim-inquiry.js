const data = require('../data/claim-inquiry');

module.exports = {
    getData: (params)=>{
        return data.getData(params);
    },
    
    getClaimComments: (params)=>{
        params.claim_id = params.customArgs.claim_id;
        return data.getClaimComments(params);
    },

    getClaimComment: (params)=>{
        return data.getClaimComment(params);
    }
};
