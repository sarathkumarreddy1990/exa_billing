const data = require('../data/app-settings');
const hotkeys = require('../shared/hotkeys');

module.exports = {
    getData: async function (params) {
        const response = await data.getData(params);

        if (!response.rows.length) {
            return response;
        }

        response.rows[0].hotkeys = hotkeys;
        return response;
    }
};
