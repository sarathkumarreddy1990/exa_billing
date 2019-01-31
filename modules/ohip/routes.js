const express = require('express');
const router = express.Router();

const responseCodes = require('./hcv/responseCodes');

const getRandomResponseCode = (codes) => {
    return codes[Math.floor(Math.random()*codes.length)];
};

const getRandomValidHealthNumberResponseCode = () => {
    return getRandomResponseCode([50, 51, 52, 53, 54, 55]);
};
console.log('routes configurted');

router.get('/hcv', (req, res) => {
console.log('hcv endpoiint hit');
    const {
        healthNumber,
        versionCode,
    } = req.query;

    let result = {
        isValid: false,
    };

    if (healthNumber.length === 10) {
        console.log( 'VERSION CODE: ' + versionCode);
        if (versionCode === 'OK') {
            result.isValid = true;
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
