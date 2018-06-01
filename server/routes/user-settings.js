const Router = require('express-promise-router');
const router = new Router();

const userSettingsController = require('../controllers/user-settings');

router.get('/', async function (req, res) {
    const data = await userSettingsController.getGridFields(req.query);
    return res.send(JSON.parse(data));
});

router.post('/', async function (req, res) {
    const data = await userSettingsController.save(req.body);
    return res.send(data);
});

module.exports = router;