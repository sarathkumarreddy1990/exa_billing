const Router = require('express-promise-router');
const router = new Router();

const controller = require('../../controllers/setup/auto-billing');
const httpHandler = require('../../shared/http');

const logger = require('../../../logger');

router.get('/', async (req, res) => {
    const data = await controller.getAutobillingRules(req.query);

    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async (req, res) => {
    const data = await controller.getAutobillingRule(req.params);
    httpHandler.sendRows(req, res, data);
});


router.post('/', async (req, res) => {
    const data = await controller.createAutobillingRule(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async (req, res) => {
    const data = await controller.updateAutobillingRule(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async (req, res) => {
    const data = await controller.deleteAutobillingRule(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
