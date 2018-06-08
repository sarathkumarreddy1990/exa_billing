const Router = require('express-promise-router');
const router = new Router();

const studyFilterController = require('../../controllers/setup/study-filter');
const httpHandler = require('../../shared/http');

router.post('/', async function (req, res) {
    const data = await studyFilterController.save(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await studyFilterController.save(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/', async function (req, res) {
    const data = await studyFilterController.get(req.query);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await studyFilterController.delete(req.body);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;