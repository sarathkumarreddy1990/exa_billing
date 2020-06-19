define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/views/modals/modalInput'
        , 'modules/multichat/views/modals/userSearchBase'
        , 'text!modules/multichat/templates/modals/memberSearcher.html'
        , 'text!modules/multichat/templates/userAvatar.html'
        , 'text!modules/multichat/templates/groupAvatar.html'
    ],
    function (
        $
        , _
        , Backbone
        , ModalInput
        , UserSearchBase
        , templateMemberSearcher
        , templateUserAvatar
        , templateGroupAvatar
    ) {

        return ModalInput.extend(UserSearchBase).extend({

            events: {
                "click .js_chat-modal-member-searcher__back": "close"
            },

            templateUserAvatar: _.template(templateUserAvatar),
            templateGroupAvatar: _.template(templateGroupAvatar),

            initialize: function (options) {
                options = options || {};

                this.initSearchInput(options);

                options.templates = {
                    headerFrom: templateMemberSearcher,
                    bodyFrom: templateMemberSearcher,
                    footerFrom: templateMemberSearcher
                };

                this.roomModel = options.data.room;

                options.actions = 'actions' in options ? options.actions : {};
                options.actions.inputKeyUpAction = this.onSearchInputChange;
                options.actions.modalAction = this.selectSearchResultOperation;

                ModalInput.prototype.initialize.call(this, options);
            },

            getActionData: function(el){
                return {
                    userId: el.currentTarget.dataset['userId'],
                    groupId: el.currentTarget.dataset['groupId']
                }
            },

            selectSearchResultOperation: function(options) {
                var self = this;
                if (options.userId !== undefined) {
                    this.roomModel.addMemberById(options.userId, function(){
                        self.close(options.userId);
                    });
                } else if (options.groupId !== undefined) {
                    this.roomModel.addGroupById(options.groupId, function(){
                        self.close(options.groupId);
                    });
                }

            }
        })
    }
)
