define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'moment-timezone'
        , 'modules/multichat/views/roomList'
        , 'modules/multichat/views/modals/privateRoomCreator'
        , 'modules/multichat/views/modals/multiuserRoomCreator'
        , 'modules/multichat/utils/utils'
        , 'text!modules/multichat/templates/chat.html'
        , 'text!modules/multichat/templates/contactLine.html'
        , 'text!modules/multichat/templates/userAvatar.html'
        , 'text!modules/multichat/templates/contactList.html'
        , 'modules/multichat/utils/triggers'
    ],
    function (
        $
        , _
        , Backbone
        , MomentTimezone
        , RoomList
        , ModalPrivateRoomCreator
        , ModalMultiuserRoomCreator
        , Utils
        , templateChat
        , templateContactLine
        , templateUserAvatar
        , templateContactList
        , Triggers
    ) {

        return Backbone.View.extend({

            el: '.chat-panel',
            templateChat: _.template(templateChat),
            templateContactLine: _.template(templateContactLine),
            templateUserAvatar: _.template(templateUserAvatar),
            templateContactList: _.template(templateContactList),

            events: {
                "change .js_user-status": "onSelfStatusChanged",
                "click .js_chat-item": "onRoomSelect",
                "click .js_btn__plus": "onCreateOrSearchRoom",
            },

            tickInterval: 60000,

            initialize: function (options) {
                this.chatModel = options.chatModel;
                this.momentTimezone = MomentTimezone;
                this.chatModel.set({'is_drawn': false});

                var rooms = this.chatModel.get('rooms');

                this.listenTo(rooms, 'remove add sort reset', _.debounce(_.bind(this.renderContacts, this), 200));
                this.listenTo(rooms, Triggers.OPEN_ROOM, this.onOpenRoom);
                this.listenTo(rooms, 'add', this.onCreateRoom);
                this.listenTo(rooms, 'change:possessive.is_favorite', this.renderContacts);
                this.listenTo(rooms, 'change:isActive', this.onActiveRoomChange, this);
                this.listenTo(rooms, 'change:members change:title change:roomType', this.renderContactLine);
                this.listenTo(rooms, 'change:possessive.unread_count', _.debounce(_.bind(this.onUnreadChange, this), 200));
                this.listenTo(rooms._usersCache, 'change:chat_status', this.onPrivateRoomStatusChange);
                this.listenTo(app.chat, Triggers.MINIMIZED_CONTACT_LIST, this.onChatMinimizeChange, this);

                this.listenToOnce(this.chatModel, "change:me", function (chat, user) {
                    this.listenTo(this.chatModel.get('me'), "change:possessive", this.renderPossessive);
                    this.listenTo(this.chatModel.get('me'), "change:chat_status", this.renderSelfStatus);

                    this.chatModel.get('me').trigger('change:possessive', this.chatModel.get('me'), user.get('possessive'));
                    this.chatModel.get('me').trigger('change:chat_status', this.chatModel.get('me'), user.get('chat_status'));
                });

                /* We have to catch ESC code on whole document*/
                _.bindAll(this, ['onEsc']);
                $(document).on('keyup', this.onEsc);
            },

            onRoomSelect: function (event) {
                var roomId = event.currentTarget.getAttribute('data-room-id');
                if (roomId) {
                    this.roomList.openRoom(roomId);
                }
                return this;
            },

            draw: function () {
                var self = this;
                this.$el.html(this.templateChat({
                    userFullName: app.userInfo.userFullName,
                    templateContactList: self.templateContactList,
                }));
                if (!this.roomList) {
                    this.roomList = new RoomList({el: $('.js_chat-room-wrap')});
                }

                this.chatModel.set({'is_drawn': true});
                this.tickTimer(true);
                this.makeChatResizable();
                app.chat.trigger(Triggers.MINIMIZED_CONTACT_LIST, true);
            },


            onSelfStatusChanged: function (event) {
                var el = $(event.currentTarget);
                var value = el.val();
                event.preventDefault();
                this.chatModel.get('me').setStatus(value);
            },

            renderSelfStatus: function (user, newStatus) {
                var self_status = newStatus;
                var self_status_prev = user._previousAttributes.chat_status;
                this.$('.js_user-status')
                    .removeClass('user-status--' + self_status_prev)
                    .addClass('user-status--' + self_status);
                this.$('.js_user-status option[value=' + self_status_prev + ']').prop("selected", false);
                this.$('.js_user-status option[value=' + self_status + ']').prop("selected", true);
            },

            renderPossessive: function (user, possessive) {

                var canCreate = possessive.can_create_rooms && Array.isArray(possessive.can_create_rooms) && possessive.can_create_rooms.length > 0;
                var isDrawn = this.chatModel.get('is_drawn');

                if ((canCreate || this.chatModel.get('rooms').length > 0) && !isDrawn) {
                    this.draw();
                    isDrawn = this.chatModel.get('is_drawn');
                }

                if (canCreate && isDrawn) {
                    $('.js_btn__plus').removeClass('hidden');
                } else {
                    $('.js_btn__plus').addClass('hidden')
                }
            },

            makeChatResizable: function(){
                this.$el.find('.js_chat-panel').resizable({
                    handles: "n",
                    minHeight: 310,
                    resize: function( event, ui ) {
                        ui.element.eq(0).css('top', 'initial');

                        if (ui.element.offset().top <= window.innerHeight / 100 * 2) {
                            ui.size.height = (ui.size.height - (window.innerHeight / 100 * 2 - ui.element.offset().top));
                        }
                    }
                });
            },

            renderContacts: function () {
                var self = this;

                if (self.chatModel.get('rooms') && !_.isEmpty(self.chatModel.get('rooms').models)) {
                    if(self.chatModel.get('is_drawn') === false){
                        self.draw();
                    }

                    var chatListNonFavorite = [];
                    var chatListFavorite = [];
                    var chatListNonFavoriteHtml = '';
                    var chatListFavoriteHtml = '';

                    this.divideRoomsByFavorites(this.chatModel.get('rooms').models, chatListNonFavorite, chatListFavorite);

                    chatListFavorite.sort(function(a, b) {
                        return a.get('title').localeCompare(b.get('title'), undefined, {numeric: true, sensitivity: 'base'});
                    });


                    _.forEach(chatListNonFavorite, function (chatItem) {
                        chatListNonFavoriteHtml += self.getRoomsTemplateHtml(chatItem);
                    });

                    _.forEach(chatListFavorite, function (chatItem) {
                        chatListFavoriteHtml += self.getRoomsTemplateHtml(chatItem);
                    });

                    this.$('.js_chat-room-list').html(chatListNonFavoriteHtml);
                    this.$('.js_chat-room-list-favorite').html(chatListFavoriteHtml);
                    this.renderLastMessagesTimeTag();
                } else {
                    this.$('.js_chat-room-list').text('');//clear room list
                    this.$('.js_chat-room-list-favorite').text('');//clear favorite room list
                    this.roomViews = [];
                }
                commonjs.updateCulture(app.currentCulture);


                return this;
            },

            renderRoomIconLastTime: function (room) {
                var lastMessageShortTimestamp = Utils.generateShortTimestamp(room.get('lastMessageDt') || room.get('createdDt'), MomentTimezone);
                $('.js_chat-item[data-room-id=' + room.get('id') + '] .js_chat-item__date').text(lastMessageShortTimestamp);
            },

            renderLastMessagesTimeTag: function() {
                var self = this;
                if (!_.isEmpty(self.chatModel.get('rooms').models)) {
                    _.forEach(self.chatModel.get('rooms').models, function (room) {
                        self.renderRoomIconLastTime(room);
                    })
                }
            },

            tickTimer: function (setTicking) {
                var self = this;
                if (this.timer) {
                    clearInterval(this.timer);
                }
                if (true === setTicking) {
                    this.timer = setInterval(function () {
                        self.renderLastMessagesTimeTag();
                    }, this.tickInterval);
                }
            },

            onChatMinimizeChange: function (isMinimize) {
                this.expandOrMinimizeChat(isMinimize);
            },

            expandOrMinimizeChat: function (isMinimized) {
                if (isMinimized) {
                    $('.js_chat-panel').addClass('hidden');
                    $('.js_chat--minimized').removeClass('hidden');
                    this.tickTimer(false);
                }
                else {
                    $('.js_chat-panel').removeClass('hidden');
                    $('.js_chat--minimized').addClass('hidden');
                    this.renderLastMessagesTimeTag();
                    this.tickTimer(true);
                }
            },

            openModalAddUsers: function () {
                var self = this;
                var modal = new ModalPrivateRoomCreator({data: {chat: this.chatModel}});
                modal.show();

                $('.js_chat-modal__input').focus();

                var onCloseModal = function(data){
                    if(data && 'multiuserRoomCreator' in data){
                        self.stopListening(modal);
                        modal = data.multiuserRoomCreator;
                        self.listenTo(modal, Triggers.CLOSE_MODAL, onCloseModal);
                    } else if(data && 'roomId' in data){
                        self.stopListening(modal);
                    }
                };

                this.listenTo(modal, Triggers.CLOSE_MODAL, onCloseModal);
            },

            openMultiuserRoomCreator: function() {
                var multiuserRoomCreator = new ModalMultiuserRoomCreator({data: {chat: this.chatModel}});
                multiuserRoomCreator.show();
            },

            onCreateOrSearchRoom: function(){
                var canCreateRooms = app.chat.chatModel.get('me').get('possessive').can_create_rooms;
                if(canCreateRooms.indexOf('private') > -1){
                    this.openModalAddUsers();
                    return;
                }
                this.openMultiuserRoomCreator();
            },

            onEsc: function (event) {
                var keyCode = event.keyCode || event.which;
                if (!ModalPrivateRoomCreator.checkModalsOpen() && keyCode === 27) {
                    this.roomList.closeLeftRoomView();
                }
            },

            divideRoomsByFavorites: function (rooms, chatListNonFavorite, chatListFavorite) {
                _.forEach(rooms, function (room) {
                    if (room.get('possessive').is_favorite) {
                        chatListFavorite.push(room);
                    }
                    else {
                        chatListNonFavorite.push(room);
                    }
                });
            },

            getRoomsTemplateHtml: function (room) {
                return this.templateContactLine({
                    room: room,
                    users: room.get('members'),
                    userID: app.userID,
                    templateUserAvatar: this.templateUserAvatar
                });
            },

            renderContactLine: function (updatedRoom) {
                var chatItemHtml = this.getRoomsTemplateHtml(updatedRoom);
                var chatItem = this.$('.js_chat-item[data-room-id="' + updatedRoom.id + '"]').eq(0);

                chatItem.replaceWith(chatItemHtml);
                this.renderRoomIconLastTime(updatedRoom);
            },

            onUnreadChange: function (updatedRoom) {
                var unread_count = updatedRoom.get('possessive').unread_count;
                var badge = $('.js_chat-item[data-room-id="' + updatedRoom.id + '"] .js_chat-item__badge');

                if (unread_count > 0) {
                    if (!this.roomList.getOpenedRoomView(updatedRoom.id) || this.roomList.isRoomMinimized(updatedRoom.id)) {
                        badge.text(unread_count);
                        badge.removeClass('hidden');
                    }
                } else {
                    badge.text('');
                    badge.addClass('hidden');
                }
            },

            onPrivateRoomStatusChange: function (updatedUser) {
                var self = this;

                _.forEach(this.chatModel.get('rooms').models, function (room) {
                    if (room.get('roomType') === 'private' && self.checkIsUserExistInRoom(room, updatedUser.id)) {
                        self.changePrivateRoomStatus(updatedUser._previousAttributes.chat_status, updatedUser.get('chat_status'), updatedUser.id);
                    }
                });
            },

            checkIsUserExistInRoom: function (room, userId) {
                var isExist = false;

                _.forEach(room.get('members'), function (member) {
                    if (member.id === userId) {
                        isExist = true;
                    }
                })

                return isExist;
            },

            changePrivateRoomStatus: function (previousStatus, newStatus, id) {
                var privateRoomStatus = $('.js_userAvatarStatus[data-user-id="' + id + '"]');

                privateRoomStatus
                    .removeClass('chat-user-avatar-wrap-status--' + previousStatus)
                    .addClass('chat-user-avatar-wrap-status--' + newStatus);
            },

            onOpenRoom: function(roomId){
                var room = app.chat.chatModel.get('rooms').get(roomId);
                if(room){
                    this.roomList.openRoom(roomId);
                    return
                }
                this.roomToOpen = roomId;
            },

            onCreateRoom: function(model){
                if(this.roomToOpen && this.roomToOpen === model.get('id')) {
                    this.roomList.openRoom(this.roomToOpen);
                    this.roomToOpen = null;
                }
            },

            onActiveRoomChange: function (room, isActive) {
                var roomId = room.get('id');

                if (isActive) {
                    this.setActiveRoomInContactList(roomId);
                }
                else {
                    this.unsetActiveRoomInContactList(roomId);
                }
            },

            setActiveRoomInContactList: function (roomId) {
                $('.js_chat-item[data-room-id="' + roomId + '"]').addClass('chat-item--active');
            },

            unsetActiveRoomInContactList: function (roomId) {
                $('.js_chat-item[data-room-id="' + roomId + '"]').removeClass('chat-item--active');
            }
        })
    }
)
