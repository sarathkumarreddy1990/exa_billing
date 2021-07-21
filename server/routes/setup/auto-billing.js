const Router = require('express-promise-router');
const router = new Router();

const autobillingData = require('../../data/setup/auto-billing');
const httpHandler = require('../../shared/http');

router.get('/', async (req, res) => {
    const data = await autobillingData.getAutobillingRules(req.query);

    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async (req, res) => {
    const data = await autobillingData.getAutobillingRule(req.params);
    httpHandler.sendRows(req, res, data);
});


router.post('/', async (req, res) => {
    const data = await autobillingData.createAutobillingRule(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async (req, res) => {
    const data = await autobillingData.updateAutobillingRule(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async (req, res) => {
    const data = await autobillingData.deleteAutobillingRule(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
