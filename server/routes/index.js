const express = require('express');
const router = express.Router();

const { staticAssetsRoot } = require('../shared/constants');

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', {
        title: 'EXA-Billing',
        staticAssetsRoot
    });
});

module.exports = router;
