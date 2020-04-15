define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'moment-timezone'
        , 'modules/multichat/models/chat'
        , 'modules/multichat/views/contactList'
        , 'modules/multichat/utils/triggers'
    ],
    function (
        $
        , _
        , Backbone
        , MomentTimezone
        , ChatModel
        , ContactList
        , Triggers
    ) {

        return Backbone.View.extend({

            el: '.chat-panel',

            events: {
                "click .js_chat--minimized": "showChat",
                "click .js_btn__resize": "hideChat"
            },

            tickInterval: 60000,

            updateChatTheme: function(theme){ //commonjs (public/javascripts/shared/common.js) uses it to trigger theme change
              var chatPanel = document.getElementsByClassName('chat-panel')[0];
              if(chatPanel){
                chatPanel.className = 'chat-panel';
                chatPanel.classList.add('theme-' + theme);
              }
            },

            initialize: function () {
                var self = this;
                i18n.loadDefaultLanguage(function () {
                    self.initMomentLocale();
                    self.chatModel = new ChatModel({userId: app.userID});
                    app.chat= self;
                    app.chat.beep = new Audio('/javascripts/modules/multichat/resx/knock.ogg');

                    self.contactListView = new ContactList({chatModel: self.chatModel});
                });
            },

            hideChat: function (event) {
                event.stopImmediatePropagation();
                app.chat.trigger(Triggers.MINIMIZED_CONTACT_LIST, true);
            },

            showChat: function (event) {
                event.stopImmediatePropagation();
                app.chat.trigger(Triggers.MINIMIZED_CONTACT_LIST, false);
            },

            initMomentLocale: function(){
                MomentTimezone.fn.fromNowOrNow = function (a) {
                    if (Math.abs(moment().diff(this)) < 1000) {
                        return i18n.get('chat.timestamp.now');
                    }
                    return this.fromNow(a);
                };

                MomentTimezone.locale(browserLocale, {
                    relativeTime: {
                        past: '%s ' + i18n.get('chat.timestamp.ago'),
                        s: '%d ' + i18n.get('chat.timestamp.shortFormate.seconds'),
                        ss: '%d ' + i18n.get('chat.timestamp.shortFormate.seconds'),
                        m: '%d ' + i18n.get('chat.timestamp.shortFormate.minutes'),
                        mm: '%d ' + i18n.get('chat.timestamp.shortFormate.minutes'),
                        h: '%d ' + i18n.get('chat.timestamp.shortFormate.hours'),
                        hh: '%d ' + i18n.get('chat.timestamp.shortFormate.hours'),
                        d: '%d ' + i18n.get('chat.timestamp.shortFormate.days'),
                        dd: '%d ' + i18n.get('chat.timestamp.shortFormate.days'),
                        M: '%d ' + i18n.get('chat.timestamp.shortFormate.months'),
                        MM: '%d ' + i18n.get('chat.timestamp.shortFormate.months'),
                        y: '%d ' + i18n.get('chat.timestamp.shortFormate.years'),
                        yy: '%d ' + i18n.get('chat.timestamp.shortFormate.years')
                    },
                    calendar : {
                        lastDay : '[Yesterday]',
                        sameDay : '[Today]',
                        nextDay : '[Tomorrow]',
                        lastWeek : '[Last] dddd',
                        nextWeek : '[Next] dddd',
                        sameElse : 'L'
                    }
                });
            },
        })
    }
);
