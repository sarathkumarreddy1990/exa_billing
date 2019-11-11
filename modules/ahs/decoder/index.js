const RemittanceAdviceParser = require('./utils');
const RemittanceAdviceFields = require('./claimItemFields');

const Parser = {

    /***
     * {param} String Data need to parse
     * {Array} Returns array of parsed claim data
     */
    parseARDFile: (dataStr) => {

        let claims = [];
        const records = dataStr.split('\n');

        records.forEach((recordStr) => {

            try {
                claims.push(RemittanceAdviceParser.parseRecord(recordStr, RemittanceAdviceFields));
            }
            catch(err) {
                console.log(` Error occured in file parsing '${err}'`);
            }
        });

        return claims;
    }
};

module.exports = Parser;
