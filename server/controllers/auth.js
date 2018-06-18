const data = require('../data/auth');

module.exports = {
    
    getExpiredTimeout: function (sessionID) {
        return data.getExpiredTimeout(sessionID);
    },
    
    updateLastAccessed: function (sessionID) {
        return data.updateLastAccessed(sessionID);
    },
};
