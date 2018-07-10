const shared = require('../shared');
const { permissionsMap } = require('../shared/constants');
const _ = require('lodash');

module.exports = {

    checkRights: function (args) {
        const defaultAPIs =   ['/exa_modules/billing/app_settings', '/exa_modules/billing/app_settings/i18n/es_us.json', '/exa_modules/billing/app_settings/i18n/default.json',
            '/exa_modules/billing/user_settings'];
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

        if(defaultAPIs.indexOf(route) > -1){
            return true;
        }
        
        if (!moduleNameInternal) {
            return false;
        }

        if (!screenNameInternal) {
            return false;
        }   

        if( _.includes(route, 'claim_patient')) {
            screenNameInternal =  'claim_patient';
        }

        let permissionName = permissionsMap[screenNameInternal];

        if(screenNameInternal == 'list'){
            permissionName = moduleNameInternal == 'era' ? 'ERAI' : 'PAYM';
        }

        if (screens.indexOf(permissionName) > -1) {
            return true;
        }

        return false;
    }
};
