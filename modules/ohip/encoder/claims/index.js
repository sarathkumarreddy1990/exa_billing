const fs = require('fs');
const path = require('path');

module.exports = function() {
    // HGAU73.441

    return {
        encode: (claimData, context) => {
            const claimSubmissions = [];
            claimSubmissions.push(fs.readFileSync(path.join(__dirname, 'HGAU73.441'), {encoding:'ascii'}));
            return claimSubmissions;
        }
    }
};
