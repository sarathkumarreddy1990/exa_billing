define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/models/chat'
        , 'modules/multichat/views/modals/modalInput'
        , 'modules/multichat/views/modals/userSearchBase'
        , 'modules/multichat/views/modals/multiuserRoomCreator'
        , 'text!modules/multichat/templates/modals/privateRoomCreator.html'
        , 'text!modules/multichat/templates/userAvatar.html'
        , 'text!modules/multichat/templates/groupAvatar.html'
    ],
    function (
        $
        , _
        , Backbone
        , Chat
        , ModalInput
        , UserSearchBase
        , MultiuserRoomCreator
        , templatePrivateRoomCreator
        , templateUserAvatar
        , templateGroupAvatar
    ) {

        return ModalInput.extend(UserSearchBase).extend({

            templateUserAvatar: _.template(templateUserAvatar),
            templateGroupAvatar: _.template(templateGroupAvatar),

            events: {
                'click .js_chat-modal__add-multiuser-room': 'openMultiuserRoomCreator'
            },

            initialize: function (options) {
                options = options || {};
                this.chatModel = options && 'data' in options && 'chat' in options.data ? options.data.chat : null;
                options.searchScope = 'usersOrGroups';
                this.initSearchInput(options);

                options.templates = {
                    headerFrom: templatePrivateRoomCreator,
                    bodyFrom: templatePrivateRoomCreator,
                    footerFrom: templatePrivateRoomCreator
                };

                options.actions = 'actions' in options ? options.actions : {};
                options.actions.inputKeyUpAction = this.onSearchInputChange;
                options.actions.modalAction = this.selectSearchResultOperation;

                ModalInput.prototype.initialize.call(this, options);
            },

            openMultiuserRoomCreator: function(){
                var multiuserRoomCreator = new MultiuserRoomCreator({data: {chat: this.chatModel}})
                multiuserRoomCreator.show();
                $('.js_chat-new__title').focus();
                this.close({multiUserRoomCreator: multiuserRoomCreator});
            },

            getActionData: function(el){
                return {
                    userId:     el.currentTarget.dataset['userId'],
                    groupId:    el.currentTarget.dataset['groupId'],
                    groupTitle: el.currentTarget.getElementsByClassName('chat-modal-group__name')[0] ? el.currentTarget.getElementsByClassName('chat-modal-group__name')[0].textContent : ''
                }
            },

            selectSearchResultOperation: function(options, modalResult) {
                if(this.chatModel){
                    var self = this;


                    if (options.userId !== undefined) {

                        if(modalResult){
                            modalResult(options.userId);
                        }
                        this.chatModel.get('rooms').getPrivateRoom(options.userId, function (roomId) {
                            self.close({roomId: roomId});
                        });

                    } else if (options.groupId !== undefined) {

                        var postFields = {
                            roomType: 'adhoc',
                            title: 'Ad Hoc ' + options.groupTitle,
                            users: [app.userID]
                        };

                        app.chat.chatModel
                            .get('rooms')
                            .createRoom(postFields, function (createdRoomId) {
                                app.chat.chatModel
                                    .get('rooms')
                                    .find({id: createdRoomId})
                                    .addGroupById(options.groupId, function(){
                                        self.close();
                                    });
                            });
                    }

                }

            }
        })
    }
)
