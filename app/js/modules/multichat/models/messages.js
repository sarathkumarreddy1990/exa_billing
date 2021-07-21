define([
        'jquery'
      , 'backbone'
      , 'moment-timezone'
      , 'modules/multichat/utils/errorHandler'
    ],
    function (
        $
      , Backbone
      , MomentTimezone
      , ErrorHandler
    ) {
        var MessageModel = Backbone.Model.extend({
            defaults: {
                id: 0,
                author: null,
                createdDt: null,
                content: null
            },

            initialize: function (attributes, options) {
                _.extend(this, ErrorHandler);
            },
            
            getTimestamp: function (){
                return MomentTimezone(this.get('createdDt'));
            },
            
            getTimeDiffFrom: function(prevMessage) {
                return this.getTimestamp().diff(prevMessage.getTimestamp(), 'minutes');
            },

            getTimeDiffFromNow: function() {
                //TECHDEBT: Is this moment() is same to MomentTimezone above and available globally?
                //If so, manual importing of MomentTimezone may be avoided
                return moment().diff(this.getTimestamp(), 'minutes');
            },
            
            getAuthor: function() {
                //TECHDEBT: Why do we have .author field with the only .user field inside?
                return this.get('author').user;
            },
            
            getAuthorId: function() {
                return this.getAuthor().get('id');
            }
        });

        // "Static" API
        MessageModel.
            _messageModelFromResponse = function(usersCache, messageResponse) {
                var attributes = {
                    id: messageResponse.id
                  , createdDt: messageResponse.created_dt
                  , content: messageResponse.content
                };
                var messageModel = new MessageModel(attributes, { usersCache: usersCache });

                usersCache.fetchUserById(messageResponse.created_by, function(err, userModel) {
                    if (userModel && !err) {
                        messageModel.set('author', userModel);
                    }
                });

                return messageModel;
            };


        var MessagesCollection = Backbone.Collection.extend({

            attributes: {
                roomId: 0
            },

            model: MessageModel,

            initialize: function (models, options) {
                _.extend(this, ErrorHandler);
                this.momentTimezone = MomentTimezone;
                this.attributes = Object.assign({}, this.attributes, { self: this, roomId: options.id });
                this._usersCache = options.usersCache;
            },

            comparator: function(m1, m2) {
                return (this.momentTimezone(m1.get('createdDt'))-this.momentTimezone(m2.get('createdDt'))) || (m1.get('id') - m2.get('id'));
            },

            _DIRECTION_FORWARD:  'forward',
            _DIRECTION_BACKWARD: 'backward',

            _fetchWithParameters: function(limit, direction, messageId, cb) {
                var self = this;
                var url = '/chat/rooms/' + this.attributes.roomId + '/messages?';
                if (limit) url += 'limit=' + limit + '&';
                if (direction) url += 'direction=' + direction + '&';
                if (messageId) url += 'message_id=' + messageId + '&';

                $.ajax({
                    url: url,
                })
                .then(
                    function (response) {
                        if (response.status == 'ok' && 'result' in response && 'messages' in response.result && Array.isArray(response.result.messages)) {

                            var messagesAttributes = _.map(response.result.messages, function(messageResponse) {
                                return MessageModel._messageModelFromResponse(self._usersCache, messageResponse);
                            });
                            var newMessageModels = self.add(messagesAttributes, { merge: true });

                            if (typeof(cb) == 'function') cb(null, newMessageModels);

                            var options = {
                                'messageId' : messageId,
                                'limit': limit,
                                'newMessageModels': newMessageModels
                            }

                            if (direction == self._DIRECTION_BACKWARD) {
                                self.trigger(MessagesCollection.TRIGGER_HISTORY_PULLED, options);
                            }

                        } else {
                            cb(response);
                        }
                    },
                    function (err) {
                        self.handleRequestError(err);
                        cb(err);
                    }
                );
            },

            _mergeResponse: function(messagesResponses) {
                var self = this;
                var messagesAttributes = _.map(messagesResponses, function(messageResponse) {
                    return MessageModel._messageModelFromResponse(self._usersCache, messageResponse);
                });
                self.add(messagesAttributes, { merge: true });
            },

            fetchInitial: function(cb) {
                this._fetchWithParameters(MessagesCollection.MESSAGE_WINDOW, this._DIRECTION_BACKWARD, null, cb);
            },
            fetchBackward: function(cb) {
                var firstId = 0;
                var firstMessageModel = this.first();
                if (firstMessageModel) firstId = firstMessageModel.get('id');
                this._fetchWithParameters(MessagesCollection.MESSAGE_WINDOW, this._DIRECTION_BACKWARD, firstId, cb);
            },
            fetchForward: function(cb) {
                var lastId = 0;
                var lastMessageModel = this.last();
                if (lastMessageModel) lastId = lastMessageModel.get('id');
                this._fetchWithParameters(null, this._DIRECTION_FORWARD, lastId, cb);
            }        
        });

        // "Static" API
        MessagesCollection.
            MESSAGE_WINDOW = 20;
        MessagesCollection.
            TRIGGER_HISTORY_PULLED = 'history_pulled';

        return MessagesCollection;
    });

