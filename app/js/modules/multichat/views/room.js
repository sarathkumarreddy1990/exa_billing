define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'moment-timezone'
        , 'quill'
        , 'text!modules/multichat/templates/dateSeparator.html'
        , 'modules/multichat/views/modals/roomSettings'
        , 'text!modules/multichat/templates/room.html'
        , 'text!modules/multichat/templates/message.html'
        , 'text!modules/multichat/templates/userAvatar.html'
        , 'modules/multichat/utils/utils'
        , 'modules/multichat/utils/exalinks'
        , 'modules/multichat/utils/triggers'
    ],
    function (
        $
        , _
        , Backbone
        , MomentTimezone
        , Quill
        , templateDateSeparator
        , RoomSettings
        , templateRoom
        , templateMessage
        , templateUserAvatar
        , Utils
        , ExaLinks
        , Triggers

    ) {

        var RoomView = Backbone.View.extend({

            tagName: 'li',

            templateRoom: _.template(templateRoom),
            templateDateSeparator: _.template(templateDateSeparator),
            templateMessage: _.template(templateMessage),
            templateUserAvatar: _.template(templateUserAvatar),

            events: {
                "click .js_chat-content-header__close": "onClose"
                , "click .js_chat-content-footer__btn-submit": "onMessageSend"
                , "click .js_chat-content-header__favorite": 'onAddToFavorite'
                , "click .js_chat-content-header__hide, .js_chat-content--minimized": "onMinimize"
                , "click .js_earlier-messages": "onLoadEarlier"
                , "click .js_chat-content-header__chat-settings": "openModalRoomSettings"
                , "click .js_chat-content-header__refresh": "onRefresh"
                , "click .js_chat-content": "onSetActiveRoom"
            },

            initialize: function (options) {
                this.roomList = options.roomList;
                this.momentTimezone = MomentTimezone;

                var self = this;

                var listenToMessages = function(){
                    var messages = self.model.get('messages');
                    self.listenTo(messages, "reset update", self.onMessagesUpdate);
                    self.listenTo(messages, "history_pulled", _.debounce(_.bind(self.onHistoryPulled, self), 200));//200ms to reduce onHistoryPulled calls
                };
                this.listenTo(this.model, "change:messages", function(){
                    listenToMessages();
                });
                listenToMessages();

                this.listenTo(this.model, "change:isMinimized", this.onMinimizedChange);
                this.listenTo(this.model, "change:possessive.is_favorite", this.onFavoriteChange);
                this.listenTo(this.model, 'change:title', this.onTitleChange, this);

                $(this.el).append(this.templateRoom(this.model.attributes));

                this._draw();
                this._reloadMessages();
                this.makeRoomResizable();

                this.model.set('isMinimized', false);
                this.model.setIsOpenedCallback( _.bind(this._checkIsExpanded,this));
            },

            _reloadMessages: function(){
                this.model.reloadMessages();
            },

            _initQuillEditor: function() {
                var self = this;
                var quillPlaceholder = $('.chat-content[data-open-room-id=' + this.model.id + '] .message-editor').get(0);
                var scrollingContainer = $('.chat-content[data-open-room-id=' + this.model.id + '] .message-editor > .scrolling-container').get(0);

                ExaLinks.registerExalinkBlot (Quill);
                this.quill = new Quill(quillPlaceholder, {
                    modules: {
                        "toolbar": false,
                        "keyboard": {
                            bindings: {
                                tab: {
                                    key: 13,
                                    handler: _.bind(self.onMessageSend, self)
                                },

                                shiftEnter: {
                                    key: 13,
                                    shiftKey: true,
                                    handler: function(range, context) {
                                        this.quill.insertText(range.index, '\n');
                                        return false;
                                    }
                                }
                            }
                        }
                    },
                    theme: 'snow',
                    scrollingContainer: scrollingContainer
                });

                this.quill.root.addEventListener("dragover", function( event ) {
                    event.preventDefault(); //This is to allow Quill to be valid drop target
                });

                function dropHandler(event) {
                    var payload = null;
                    var range = null;

                    if (event.dataTransfer.getData('application/json')) {
                        payload = JSON.parse(event.dataTransfer.getData('application/json'));
                        range = self.quill.getSelection(true);

                        self.quill.insertEmbed(range.index + 1, 'exalink', payload, Quill.sources.USER);
                        //self.renderExalinks();
                        self.quill.insertText(range.index + 2, '\n', Quill.sources.USER);
                        self.quill.setSelection(range.index + 3, Quill.sources.SILENT);
                    }

                    if (event.dataTransfer.getData('text/plain')) {
                        payload = event.dataTransfer.getData('text/plain');
                        range = self.quill.getSelection(true);

                        self.quill.insertText(range.index, payload, Quill.sources.USER);
                        self.quill.setSelection(range.index + payload.length, Quill.sources.SILENT);
                    }
                }

                this.quill.root.addEventListener("drop", dropHandler);

                this.quill.on('text-change', function (delta, oldDelta, source) {
                    self._messageValidation();
                });

            },

            _getQuillDeltaOps: function () {
                var delta = this.quill.getContents();
                if (delta.ops.length > 1 || delta.ops[0].insert.trim().length !== 0)
                    return delta.ops;
                else
                    return false;
            },
            _clearQuillContents: function () {
                this.quill.setContents('\n');
                this.quill.enable(true);
                this.quill.focus();
            },

            _enableSendButton: function (enable) {
                this.$('.js_chat-content-footer__btn-submit').eq(0).prop('disabled', !enable);
            },

            _enableEarlierMessagesButton: function (enable) {
                var activeChatContent = this.$('.js_chat-content[data-open-room-id=' + this.model.get('id') + ']');
                var earlierMessages = activeChatContent.find('.js_earlier-messages').eq(0);
                if (enable) {
                    earlierMessages.show(0);
                }
                else {
                    earlierMessages.hide(0);
                }
            },

            makeRoomResizable: function(){
                this.$el.find('.js_chat-content').resizable({
                    handles: "n, w, nw",
                    minWidth: 340,
                    minHeight: 310,
                    resize: function( event, ui ) {
                        ui.element.eq(0).css('left', 'initial');
                        ui.element.eq(0).css('top', 'initial');
                    }
                })
            },

            onClose: function (event) {
                if (event && event.target) {
                    event.stopPropagation();
                }
                this.close();
                return this;
            },

            close: function() {
                this.model.unsetActiveRoom();
                this.trigger(Triggers.CLOSE_ROOM, this.model);
                this.$el.remove();
                this.remove();
                this.unbind();
            },

            _draw: function () {
                this.roomList.$el.prepend(this.el);
                commonjs.updateCulture(app.currentCulture);
                this._initQuillEditor();
                this._renderFavoriteIconInRoom();
                this.onSetActiveRoom();
            },

            _checkIsExpanded: function (){
                return !!this.roomList.getOpenedRoomView(this.id) && !this.roomList.isRoomMinimized(this.id);
            },

// ======= Rendering of the messages ============================

            _isSeparatorRequired: function(prevMessage, curMessage, idx) {
                if (prevMessage == null) {
                    return true;
                }
                var prevMessageTime = prevMessage.getTimestamp();
                var curMessageTime = curMessage.getTimestamp();
                return (
                        prevMessageTime.date() != curMessageTime.date() ||
                        prevMessageTime.month() != curMessageTime.month()
                );
            },

            _isAvatarRequired: function(prevMessage, curMessage, idx) {
                if (prevMessage == null) {
                    return true;
                }

                if (this._isSeparatorRequired(prevMessage, curMessage, idx)){
                    return true;
                }

                if (curMessage.getAuthorId() == prevMessage.getAuthorId()) {
                    return false;
                }

                return true;
            },

            _isTimestampOnTopOfMessageRequired: function(prevMessage, curMessage, idx) {
                var minutesInDay = 1440;
                var minutesWithoutTimestamp = 10;

                if (curMessage.getTimeDiffFromNow() >= minutesInDay) {
                    return false;
                }

                if (prevMessage == null) {
                    return true;
                }

                if (prevMessage.getAuthorId() != curMessage.getAuthorId()) {
                    return true;
                }

                if (curMessage.getTimeDiffFrom(prevMessage) < minutesWithoutTimestamp) {
                    return false;
                }

                return true;
            },

            _getContentHtml: function (content) {
                var contentHtml = content;
                contentHtml = Utils.escapeHTML(contentHtml);
                contentHtml = ExaLinks.renderExalinks(contentHtml);
                contentHtml = contentHtml.replace(/\n/g, '<br/>');
                return contentHtml;
            },

            _getMessageHtml: function(prevMessage, curMessage, idx) {
                var messageHtml = "";

                // Date separator rendering (if necessary)
                if (this._isSeparatorRequired(prevMessage, curMessage, idx)) {
                    var calendarTime = curMessage.getTimestamp().calendar();
                    messageHtml += this.templateDateSeparator({
                        calendarTime: calendarTime
                    });
                }

                // Avatar rendering (if necessary)
                var avatarHtml = "";
                if (this._isAvatarRequired(prevMessage, curMessage, idx)){
                    var user = curMessage.getAuthor();

                    avatarHtml = this.templateUserAvatar({
                        userId: user.get('id'),
                        initials: user.getInitials(),
                        chatUserAvatarType: null
                    });
                }

                // Rendering of message content itself ...
                messageHtml += this.templateMessage({
                    // ...with or without timestamp on top of it
                    showTimestampOnTop: this._isTimestampOnTopOfMessageRequired(prevMessage, curMessage, idx),

                    avatarHtml: avatarHtml,

                    message: curMessage,   //this includes _unsecure_ content string with non-converted exalinks...
                    // ...therefore we sending separate field with secured & pre-processed content
                    contentHtml: this._getContentHtml(curMessage.get('content'))
                });

                return messageHtml;
            },

            _renderAllMessages: function(messages) {
                var chatContent = this.$('.js_chat-content-body');
                var content = "";
                var self = this;

                var prevMessage = null;
                messages.forEach(function(curMessage, idx) {
                    content += self._getMessageHtml(prevMessage, curMessage, idx);
                    prevMessage = curMessage;
                });



                function detectFirstMessageId() {
                    var firstVisibleMessage = _.find(
                        chatContent[0].children,
                        function (tag) {return tag.dataset.messageId}
                    );

                    if (firstVisibleMessage) {
                        return firstVisibleMessage.dataset.messageId;
                    }
                    return null;
                };

// Preserve data needed for the "scroll keeping" after update
                var firstMessageIdBeforeUpdate = detectFirstMessageId();
                var initialScroll = chatContent[0].scrollHeight;
                var shouldScrollToBottomAfterUpdate =
                    (chatContent[0].scrollHeight
                      - chatContent[0].scrollTop
                      - chatContent[0].offsetHeight) < 20;

// Update messages content
                var earlierMessages = chatContent.find('.js_earlier-messages').eq(0);
                chatContent.html(content); //Putting content erases "Load previous messages" link, so we should preserve and then restore it
                chatContent.prepend(earlierMessages);
                this.enableAvatarTooltip();

// "Scroll keeping"
                var firstMessageIdAfterUpdate = detectFirstMessageId();
                if (shouldScrollToBottomAfterUpdate) {
                    chatContent.scrollTop(chatContent[0].scrollHeight)
                } else {
                    if (firstMessageIdAfterUpdate != firstMessageIdBeforeUpdate) {
                        chatContent.scrollTop(chatContent[0].scrollHeight - initialScroll);
                    }
                }

                this.$('.chat-content-body').on( 'scroll',  _.throttle(this.onScrolledMessagesToTop.bind(this), 500, { trailing: true, leading: true }));
            },

// ======= /ENDOF Rendering of the messages ============================

            onScrolledMessagesToTop: function(event) {
                if (event.currentTarget.scrollTop < 20) {
                    this.onLoadEarlier(event);
                }
            },

            onMessagesUpdate: function(messages, event) {
                /* possible event types: (event.changes): added/removed/merged */
                this._renderAllMessages(messages);
            },

            onLoadEarlier: function(event) {
                this.model.get('messages').fetchBackward();
            },

// ======= Attributes updates ============================

            onTitleChange: function (updatedRoom, newTitle) {
                commonjs.showStatus(updatedRoom.previous('title') + i18n.get('chat.notification.roomRenamed') + newTitle);

                // this.renderRoomIconOnElement(updatedRoom);

                this.$el.find('.js_chat-content-header__title').eq(0).html(newTitle);
                this.$el.find('.js_chat-content--minimized__title').eq(0).html(newTitle);
            },

            onFavoriteChange: function() {
                this._renderFavoriteIconInRoom();
            },

// ======= Attributes updates ============================

            onAddToFavorite: function (event) {
                var btnFavorite = event.currentTarget;
                var isRoomFavorite = this.model.get('possessive').is_favorite;

                if (isRoomFavorite) {
                    this.model.deleteFavorite();
                }
                else {
                    this.model.addFavorite();
                }

                btnFavorite.blur();
            },

            onHistoryPulled: function(options) {
                if (!_.isEmpty(this.model.get('messages')) && options.newMessageModels.length < options.limit && options.messageId) {
                    commonjs.showStatus('chat.labels.noMoreMessages');
                }

                this._enableEarlierMessagesButton(false);
            },

            onMessageSend: function () {
                var self = this;
                if (!this._messageValidation()) return false;

                var deltaOps = this._getQuillDeltaOps();
                if (deltaOps) {
                    var message = deltaOps.reduce(function (text, op) {
                        var piece = '';
                        if (typeof op.insert === 'string') {
                            piece = op.insert.trim();
                        }

                        if (typeof op.insert.exalink === 'object') {
                            piece = '{exalink}' + JSON.stringify(op.insert.exalink) + '{/exalink}'
                        }

                        return text + piece;
                    }, '');

                    this._enableSendButton(false);
                    this.model.postMessage(message, function(error, response) {
                        if (error) {
                            commonjs.handleXhrError(error, response);
                            self._enableSendButton(true);
                        } else {
                            self._clearQuillContents();
                            self._enableSendButton(true);
                        }
                    });
                }
                return false; // for quill bindings
            },

            _messageValidation: function () {
                var quillLimitMessage = _.get(this.model._usersCache.getMe().get('possessive'), 'limits.MAX_MESSAGE_LENGTH');
                var messageLength = this.quill.getLength() - 1;
                var $messageLimit = this.$('.js_message-limit').eq(0);

                if (messageLength >= quillLimitMessage * 0.7) {
                    $messageLimit.show(0);
                    $messageLimit.html(messageLength + '/' + quillLimitMessage);
                } else {
                    $messageLimit.hide(0);
                }

                if (messageLength > quillLimitMessage) {
                    this._enableSendButton(false);
                    $messageLimit.addClass('chat-content-footer__limit--red');

                    return false;
                } else {
                    this._enableSendButton(true);
                    $messageLimit.removeClass('chat-content-footer__limit--red');

                    return true;
                }
            },

            focus: function () {
                this.quill.focus();
            },

            _renderFavoriteIconInRoom: function () {
                var room = this.model;
                var isRoomFavorite = room.get('possessive').is_favorite;
                var favoriteIcon = this.$('.js_chat-content-header__favorite').eq(0);
                var chatItem = $('.js_chat-item[data-room-id="' + room.get('id') + '"]').eq(0);
                var title = '';

                if (isRoomFavorite) {
                    favoriteIcon.addClass('chat-content-header__favorite_active');
                    chatItem.addClass('chat-item_favorite');
                    title = commonjs.geti18NString('chat.labels.removeFromFavorites');
                }
                else {
                    favoriteIcon.removeClass('chat-content-header__favorite_active');
                    chatItem.removeClass('chat-item_favorite');
                    title = commonjs.geti18NString('chat.labels.addToFavorites');
                }

                favoriteIcon.attr('data-original-title', title)
                            .attr('title', title)
                            .tooltip();

                return this;
            },

            onSetActiveRoom: function () {
                if (!this.model.get('isActive')) {
                    this.onUnsetActiveRooms();
                    this.model.setActiveRoom();
                    this.focus();
                }
            },

            onUnsetActiveRooms: function () {
                _.forEach(app.chat.chatModel.get('rooms').models, function (room) {
                    if (room.get('isActive')) {
                        room.unsetActiveRoom();
                    }
                });
            },

            openModalRoomSettings: function() {
                var roomSettings = new RoomSettings({model: this.model});
                roomSettings.show();
                this.listenTo(this.model, Triggers.LEAVE_ROOM + ' ' + Triggers.ARCHIVE_ROOM, this.close);
                this.listenTo(roomSettings, 'onClose', function () {
                    this.stopListening(roomSettings);
                })
            },

            onMinimize: function (event) {
                if (event && event.target) {
                    event.stopPropagation();
                }

                this.model.set('isMinimized', !this.model.get('isMinimized'));
            },

            onMinimizedChange: function (room, setMinimized) {
                var roomChat = this.$el.find('.js_chat-content').eq(0);
                var roomChatMini = this.$el.find('.js_chat-content--minimized').eq(0);
                if (setMinimized) {
                    app.chat.trigger(Triggers.MINIMIZED_ROOM,true);
                    roomChat.addClass('hidden');
                    roomChatMini.removeClass('hidden');
                    this.model.unsetActiveRoom();
                }
                else {
                    app.chat.trigger(Triggers.MINIMIZED_ROOM,false);
                    roomChat.removeClass('hidden');
                    roomChatMini.addClass('hidden');

                    room.forwardMessagesLoad(function() {
                        var lastMessageId = room.get('lastMessageId');
                        if (lastMessageId) room.setUnreadMessage(lastMessageId);
                    });

                    this.onSetActiveRoom();
                }
            },

            onRefresh: function() {
                this._reloadMessages();
                this.model.update();
            },

            enableAvatarTooltip: function() {
                var avatars = this.$('.js_chat-user-avatar-wrap');

                avatars.tooltip();
            }
        })

        return RoomView;
    }
)
