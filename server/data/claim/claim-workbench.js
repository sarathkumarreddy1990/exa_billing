const SearchFilter = require('./claim-search-filters');

const {
    SQL,
    query
} = require('../index');

module.exports = {

    getData: async function (args) {
        return await SearchFilter.getWL(args);
    },

    updateClaimStatus: async (params) => {

        const {
            claim_status_id,
            billing_code_id,
            billing_class_id,            
            claimIds           
        } = params;

        let updateData;

        if(params.claim_status_id){
            updateData=`claim_status_id = ${claim_status_id}`;
        }else if(params.billing_code_id){
            updateData=`billing_code_id = ${billing_code_id}`;
        }
        else if(params.billing_class_id){
            updateData=`billing_class_id = ${billing_class_id}`;
        }


        let sql = SQL`UPDATE
                             billing.claims 
                        SET                      
                        
                    `;
        sql.append(updateData);        
        sql.append(`WHERE  id in (${claimIds})`);

        return await query(sql);
    }

};
