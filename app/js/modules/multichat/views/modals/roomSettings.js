define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/views/modals/modalBase'
        , 'modules/multichat/views/modals/memberSearcher'
        , 'text!modules/multichat/templates/modals/roomSettings.html'
        , 'text!modules/multichat/templates/userAvatar.html'
        , 'modules/multichat/utils/utils'
        , 'modules/multichat/utils/triggers'
    ],
    function (
        $
        , _
        , Backbone
        , ModalBase
        , ModalMemberSearcher
        , templateRoomSettings
        , templateUserAvatar
        , Utils
        , Triggers
    ) {

        var RoomSettings = ModalBase.extend({

            templateUserAvatar: _.template(templateUserAvatar),

            events: {
                "click .js_chat-modal-user__link": "openModalAddUsers",
                "click .js_chat-modal-btn-archive": "archiveRoom",
                "click .js_chat-modal-btn-leave": "leaveRoom",
                "click .js_chat-modal-form__btn": "onEditRoomTitle",
                "keyup .js_chat-modal-form__input": "roomTitleChange",
                "click .js_chat-modal-user__remove": "removeUser"
            },

            initialize: function (options) {
                options = options || {};
                options.template = templateRoomSettings;

                this.constructor.__super__.initialize.call(this, options);

                this.listenTo(this.options.model, 'change:members', function (room) {
                    this.customRender(room);
                });

                this.listenTo(this.options.model, 'change:groups', function (room) {
                    this.customRender(room);
                });

                this.listenTo(this.options.model, 'change:possessive change:roomType', _.debounce(_.bind(this.render, this), 200));
            },

            customRender: function (room) {
                var self = this;
                this.model = room || this.model;
                var templateParticipants = _.template($(templateRoomSettings).filter('#participants').html());
                var $chatParticipantsHolder = this.$('#js_chat-participants-holder');
                var individualMembers = _.filter(this.model.get('members'), function(member) { return self.model.get('direct_user_ids').includes(member.id); });

                $chatParticipantsHolder.empty();
                $chatParticipantsHolder.append(templateParticipants({
                    room: this.model,
                    members: individualMembers,
                    itemTemplate: this.templateUserAvatar
                }));
            },

            openModalAddUsers: function () {
                (new ModalMemberSearcher({data: {room: this.options.model}, searchScope: 'adhoc' == this.options.model.get('roomType') ? 'usersOrGroups' :  'users' })).show();
                $('.js_chat-modal__input').focus();
            },

            archiveRoom: function (){
                this.options.model.archive();
                this.trigger(Triggers.ARCHIVE_ROOM, this.model.id);
                this.close();
            },

            leaveRoom: function () {
                var meId = this.options.model._usersCache.getMe().get('id');
                this.options.model.removeMemberById(meId);
                this.trigger(Triggers.LEAVE_ROOM, this.model.id);
                this.close();
            },

            removeUser: function(e) {
                var userId = e.currentTarget.dataset.user;
                this.options.model.removeMemberById(userId);
            },

            onEditRoomTitle: function(event) {
                event.preventDefault();
                event.stopPropagation();

                var title = this.getRoomTitle();

                if (this.validateRoomTitle(title)) {
                    this.options.model.setTitle(title);
                }
            },

            roomTitleChange: function () {
                var title = this.getRoomTitle();

                this.validateRoomTitle(title);
            },

            validateRoomTitle: function (title) {
                var chatPossessive = this.model._usersCache.getMe().get('possessive');
                var titleCharMaxLimit = _.get(chatPossessive, 'limits.MAX_ROOM_TITLE_LENGTH');
                var titleCharMinLimit = _.get(chatPossessive, 'limits.MIN_ROOM_TITLE_LENGTH');

                this.$('.js_chat-modal-form__btn').eq(0).prop('disabled', true);
                if (title.length === 0) {
                    commonjs.showWarning('chat.errors.emptyTitle');
                    return false;
                }
                if (title.length > titleCharMaxLimit) {
                    commonjs.showWarning('chat.errors.exceedsTitleLimits');
                    return false;
                }
                if (title.length < titleCharMinLimit) {
                    commonjs.showWarning('chat.errors.deceedsTitleNameLimit');
                    return false;
                }
                this.$('.js_chat-modal-form__btn').eq(0).prop('disabled', false);
                return true;
            },

            getRoomTitle: function () {
                var title = this.$('.js_chat-modal-form__input').val();

                title = Utils.escapeHTML(_.trim(title));

                return title;
            }
        });

        return RoomSettings
    }
)
