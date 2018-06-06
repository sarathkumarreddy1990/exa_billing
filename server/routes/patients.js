const Router = require('express-promise-router');
const router = new Router();

const patientController = require('../controllers/patients');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await patientController.getById(req.query);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;