define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'modules/multichat/models/chat'
        , 'modules/multichat/views/modals/modalInput'
        , 'text!modules/multichat/templates/modals/multiuserRoomCreator.html'
    ],
    function (
        $
        , _
        , Backbone
        , Chat
        , ModalInput
        , templateMultiuserRoomCreator
    ) {

        return ModalInput.extend({

            events: {
                "click .js_chat-modal-user__link": "openModalAddUsers",
            },

            initialize: function (options) {
                options = options || {};
                options.template = templateMultiuserRoomCreator;

                options.actions = {
                    modalAction: this.addRoom,
                };

                this.chatModel = app.chat.chatModel;
                options.model = this.chatModel.get('me').get('possessive').can_create_rooms;

                this.constructor.__super__.initialize.call(this, options);
            },

            addRoom: function(data) {
                var self = this;
                var roomOptions = {
                    roomType: $('#js_chat-new__type').val(),
                    title: $('#js_chat-new__title').val()
                };
                this.chatModel.get('rooms').createRoom(roomOptions , function(roomId){
                    self.close({roomId: roomId})
                });

            }

        })
    }
)
