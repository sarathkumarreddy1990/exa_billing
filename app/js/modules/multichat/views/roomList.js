define(['jquery'
        , 'underscore'
        , 'backbone'
        , 'moment-timezone'
        , 'modules/multichat/views/room'
        , 'modules/multichat/utils/triggers'
    ],
    function (
        $
        , _
        , Backbone
        , MomentTimezone
        , RoomView
        , Triggers
    ) {

        return Backbone.View.extend({

            events: {
            },

            openedRoomViews: [],

            tickInterval: 60000,

            initialize: function () {

                $.fn.isInViewport = function() {
                    var bounding = this[0].getBoundingClientRect();
                    return (
                        bounding.top >= 0 &&
                        bounding.left >= 0 &&
                        bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );
                };

                $(window).bind('resize', _.debounce(_.bind(this.fitScreen, this), 200));//200ms to reduce fitScreen calls

                this.listenTo(app.chat, Triggers.MINIMIZED_ROOM, this.onRoomMinimized);
                this.listenTo(app.chat, Triggers.MINIMIZED_CONTACT_LIST, this.onContactListMinimized, this);
                this.listenTo(app.chat.chatModel.get('rooms'), 'remove', this.onRoomRemoved);
            },

            openRoom: function(id) {
                var roomView = this.getOpenedRoomView(id);

                if (roomView) {
                    this.setFocusOnRoomView(roomView);
                } else {
                    var roomModel = app.chat.chatModel.get('rooms').find({'id': id});
                    if(!roomModel){
                        return null;
                    }
                    roomView = new RoomView({id: id, model: roomModel, roomList: this});
                    this.listenTo(roomView, Triggers.CLOSE_ROOM, this.closeRoomView);
                    roomModel.setIsOpenedCallback(_.bind(this._isOpenedCallback, this));
                    this.openedRoomViews.push(roomView);
                }

                roomView.onSetActiveRoom();

                return roomView;
            },

            _isOpenedCallback: function (roomModel) {
                var roomView = this.getOpenedRoomView(roomModel.get('id'));
                return roomView ? true : false;
            },

            setFocusOnRoomView: function(room){
                this.setRoomMinimized(room, false);
                this.moveRoomToFirstPos(room);
                this.fitScreen();
                room.focus();
            },

            isRoomMinimized: function(id){
                return this.getOpenedRoomView(id).model.get('isMinimized');
            },

            setRoomMinimized: function(room, isMinimized){
                return this.getOpenedRoomView(room.id).model.set('isMinimized', isMinimized);
            },

            moveRoomToFirstPos: function(room){
                var temp = room.$el.detach(),
                    $elInner = $(temp.find('.js_chat-content-body')[0]);

                this.$el.prepend(temp);
                $elInner.scrollTop($elInner.prop("scrollHeight"));
                _.pull(this.openedRoomViews, room);
                this.openedRoomViews.push(room);
            },

            getOpenedRoomView: function(id){
                return _.find(this.openedRoomViews, {'id': id});
            },

            fitScreen: function() {
                var self = this;
                while ( !$(self.el).isInViewport()){
                    if(1 < self.openedRoomViews.length) {
                        this.closeLeftRoomView();
                    } else {
                        return;
                    }
                }
            },
            closeLeftRoomView: function(){
                var leftest = _.first(this.openedRoomViews);
                if(!_.isEmpty(leftest)) {
                    leftest.close();
                }
            },

            closeRoomView: function(room){
                this.stopListening(room);
                _.remove(this.openedRoomViews, ['id', room.id]);
            },

            onRoomMinimized: function(){
                //TODO: handle leftest unfitting room if it's room itself
                this.fitScreen();
            },

            onContactListMinimized: function (isMinimize) {
                var self = this;
                this.openedRoomViews.forEach(function (room) {
                    if (isMinimize || room.model.get('isMinimized')) {
                        self.setRoomMinimized(room, true);
                    }
                })
            },

            onRoomRemoved: function(room){
                var roomView = this.getOpenedRoomView(room.id);
                if(roomView){
                    roomView.close();
                }
            }
        })
    }
)
