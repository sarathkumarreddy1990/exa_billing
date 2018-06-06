const Router = require('express-promise-router');
const router = new Router();

const studyFilterController = require('../../controllers/setup/study-filter');

router.post('/', async function (req, res) {
    const data = await studyFilterController.save(req.body);
    return res.send(data);
});

module.exports = router;