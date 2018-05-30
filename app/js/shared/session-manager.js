var sessionManager = {

    activityInterval: 60000,
    sessionElapsed: 0,

    initialize: function () {

        var self = this;

        $.active = false;

        $.jStorage.subscribe("EMD_PACS_SESSION", function(channel, payload){
            //console.log(payload+ " from " + channel);
            sessionManager.sessionElapsed = 0;
        });

        $.jStorage.subscribe("EMD_PACS_LOGOUT", function(channel, payload){
            //console.log(payload+ " from " + channel);
            /// TODO: logout all tabs
        });

        //$.jStorage.listenKeyChange("SESS_FLAG", function(key, action){
        //    console.log(key + " has been " + action + ', Current Value: ' + $.jStorage.get('SESS_FLAG'));
        //});

        $('body').bind('click keypress mouseup', function () {
            $.active = true;
            $.jStorage.publish("EMD_PACS_SESSION", "ACTIVE");
        });

        this.checkActivity(app.sessionTimeout * 60 * 1000, this.activityInterval); // timeout = 30 minutes, interval = 1 minute.
    },

    checkActivity: function (timeout, interval) {
        var self = this;

        if ($.active) {

            /// Resetting session
            sessionManager.sessionElapsed = 0;
            $.active = false;

            $.get('/session_heartbeat');
        }

        //console.log('Session Elapsed: ', sessionManager.sessionElapsed);

        if (sessionManager.sessionElapsed < timeout) {
            sessionManager.sessionElapsed = sessionManager.sessionElapsed + interval;

            setTimeout(function () {
                self.checkActivity(timeout, interval);
            }, interval);
        } else {
            $.jStorage.publish("EMD_PACS_LOGOUT", "ACTIVE");
            this.redirectToLoginPage('SE');
        }
    },

    redirectToLoginPage: function (errCode) {
        // Release all user locks
        commonjs.resetScreenNameCookie();
        commonjs.emitViewerClose({
            session_id: app.sessionID,
            user_id: app.userID,
            user_name: app.userInfo.first_name + ' ' + app.userInfo.last_name,
            async: true
        });
    
        var logoutInfo = '';

        if (errCode) {
            logoutInfo = '?err=' + errCode;
        }

//        window.location = '/logout' + logoutInfo;
//        return;

        /// TODO: Handle any popups
        if (window.opener && !window.opener.closed) {
            window.close();
            if (window.config && window.config.childWin && window.config.childWin.length > 0) {
                for (var i = 0; i < window.config.childWin.length; i++) {
                    if (window.config.childWin[i]) {
                        window.config.childWin[i].onbeforeunload = null;
                        window.config.childWin[i].onunload = null;
                        window.config.childWin[i].close();
                        window.config.childWin.splice(i, 1);
                        i--;
                    }
                }
            }
            window.opener.location.href = '/logout';
        }
        else {
            window.location = '/logout';
        }
    }
};
