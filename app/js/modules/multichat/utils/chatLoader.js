define([
        'jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/views/chat'
    ],
    function (
        $
        , _
        , Backbone
        , chatModule
    ) {
        var ChatLoader = {
            routesWithChat: [ //only views with routes from this list will display the chat
                  'billing/'
                , 'reports/'
                , 'setup/'
            ],

            _isRouteValidForChat: function (routeToCheck) {
                self = this;
                return _.some(this.routesWithChat, function(routeWithChat){
                    return self.startsWith(routeToCheck, routeWithChat);
                })
            },
            startsWith: function (str, starts, position) {
                str = toString(str);
                starts = '' + starts;
                position = position == null ? 0 : Math.min(abs(position), str.length);
                return str.lastIndexOf(starts, position) === position;
            },

            loadChat: function (route, extraClass) {
               /* if (!_.has(app, 'modules.chat')
                    || !app.modules.chat
                    || app.chat) {
                    return;
                }*/
                if (app.chat) {
                    return;
                }

                if (( window.frameElement != null && window.frameElement.nodeName == 'IFRAME')
                    || window != window.top
                    || document != top.document) {
                    return;
                }

                if (!this._isRouteValidForChat(route)) {
                    return;
                }

                $("<div/>")
                  .addClass("chat-panel")
                  .addClass("chat-panel-" + extraClass)
                  .addClass("ignoreCommonClick")
                  .appendTo("body");
                app.chat = new chatModule();

            }
        };
        return ChatLoader;
    }
);
