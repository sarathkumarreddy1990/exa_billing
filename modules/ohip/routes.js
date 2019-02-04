const express = require('express');
const router = express.Router();

const responseCodes = require('./hcv/responseCodes');

const getRandomResponseCode = (codes) => {
    return codes[Math.floor(Math.random()*codes.length)];
};

const getRandomValidHealthNumberResponseCode = () => {
    return getRandomResponseCode([50, 51, 52, 53, 54, 55]);
};



router.get('/hcv', (req, res) => {
    /* This is stub/mock functionality for the Health Card Validation
     * endpoint. Theory of operation: for the sake of the demo, an
     * arbitrary 10-digit health number and two character version code is
     * specified. If the version code is "OK" and the health number is
     * exactly 10 digits, then "isValid:true" is returned. For any other
     * conditition, "isValid:false" is returned.
     */
    const {
        healthNumber,
        versionCode,
    } = req.query;

    let result = {
        isValid: false,
    };

    if (healthNumber.length === 10) {
        if (versionCode === 'OK') {
            result.isValid = true;
            // yes, there are multiple "sufficiently valid" results
            result.responseCode = getRandomValidHealthNumberResponseCode();
        }
        else {
            result.responseCode = 65;
        }
    }
    else {
        result.responseCode = 25;
    }

    result.descriptiveText = responseCodes[result.responseCode];

    return res.send(result);
});
module.exports = router;
