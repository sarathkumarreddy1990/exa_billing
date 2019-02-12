const data = require('../data/report-settings');

module.exports = {
    getReportSetting: function (params) {
        return data.getReportSetting(params);
    }
};
