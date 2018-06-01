const Router = require('express-promise-router');
const router = new Router();

const userSettingColumnController = require('../controllers/user-settings');

router.get('/', async function (req, res) {
    const data = await userSettingColumnController.userSettingColumn(req.query);
    return res.send(JSON.parse(data));
});

router.post('/', async function (req, res) {
    const data = await userSettingColumnController.save(req.body);
    return res.send(data);
});

module.exports = router;