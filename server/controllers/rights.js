const shared = require('../shared');
const { permissionsMap } = require('../shared/constants');
const _ = require('lodash');

module.exports = {

    checkRights: function (args) {
        const defaultAPIs = [
            `/exa_modules/billing/app_settings`,
            `/exa_modules/billing/user_settings`,
            `/exa_modules/billing/setup/study_filters`,
            `/exa_modules/billing/study_filters`,
            `/exa_modules/billing/setup/study_filters/set_default_tab`,
            `/exa_modules/billing/user_settings/update_grid_settings`,
            `/exa_modules/billing/ohip/validateHealthCard`,
            `/exa_modules/billing/ohip/applyRemittanceAdvice`,
            `/exa_modules/billing/ohip/downloadRemittanceAdvice`,
        ];

        let {
            screens,
            userType,
            route
        } = args;

        let {
            moduleNameInternal,
            screenNameInternal,
        } = shared.getScreenDetails(route);

        if (userType == 'SU') {
            return true;
        }

        if(moduleNameInternal == 'autoCompleteRouter') {
            return true;
        }

        if(moduleNameInternal == 'reportSettingsRouter') {
            return true;
        }

        if (defaultAPIs.indexOf(route) > -1) {
            return true;
        }

        if (!moduleNameInternal) {
            return false;
        }

        if (!screenNameInternal) {
            return false;
        }

        if (_.includes(route, 'i18n')) {
            return true;
        }

        if (_.includes(route, 'claim_patient')) {
            screenNameInternal = 'claim_patient';
        }

        let permissionName = permissionsMap[screenNameInternal];

        // EXA-10778 allowing TOS payments From RIS
        if(permissionName === 'PAYM' && screens.indexOf('TOSP') > -1) {
            return true;
        }

        if (screens.indexOf(permissionName) > -1) {
            return true;
        }

        return false;
    }
};
