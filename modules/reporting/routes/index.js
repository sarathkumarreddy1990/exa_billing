const reportingController = require('../controllers/')
    , express = require('express')
    , router = express.Router()
    ;

router.get('/render/:reportCategory/:reportId.:reportFormat', reportingController.process);
module.exports = router;
