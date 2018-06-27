const shared = require('../shared');
const { permissionsMap } = require('../shared/constants');

module.exports = {

    checkRights: function (args) {
        const defaultAPIs =   ['/exa_modules/billing/app_settings'];
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

        let permissionName = permissionsMap[screenNameInternal];

        if (screens.indexOf(permissionName) > -1) {
            return true;
        }

        return false;
    }
};
