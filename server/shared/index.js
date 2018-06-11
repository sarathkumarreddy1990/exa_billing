const {
    moduleNames,
    screenNames
} = require('./constants');

module.exports = {

    base64Encode: function (unencoded) {
        return unencoded ? new Buffer(unencoded).toString('base64') : '';
    },

    base64Decode: function (encoded) {
        return encoded ? new Buffer(encoded, 'base64').toString('utf8') : '';
    },

    getScreenDetails: function (routeParams) {
        let moduleName = 'setup';
        let screenName = 'UI';

        let apiPath = routeParams.split(/\/exa_modules\/billing\/|\/|\?/g).filter(routePrefix => !!routePrefix);
        moduleName = moduleNames[apiPath[0]] || apiPath[0] || moduleName;
        screenName = screenNames[apiPath[1]] || apiPath[1] || screenName;

        return {
            moduleName,
            screenName
        };
    }
};
