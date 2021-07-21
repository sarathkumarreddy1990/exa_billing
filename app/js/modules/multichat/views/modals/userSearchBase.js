define(['jquery'
    , 'underscore'
    , 'backbone'
    , 'modules/multichat/models/users'
    , 'modules/multichat/models/searchUsersOrGroups'
    , 'modules/multichat/models/searchusers'
    , 'text!modules/multichat/templates/modals/userSearchBase.html'
],
function (
    $
    , _
    , Backbone
    , UserCollection
    , searchUsersOrGroups
    , searchUsers
    , templateUserSearchBase
) {

    return {
        initSearchInput: function(options) {
            this.templateSearchResult = _.template(templateUserSearchBase);
            this.room = options.data.room;
            this.searchScope = options.searchScope || 'usersOrGroups';
        },

        onSearchInputChange: _.debounce(function (searchString) {
            var minInputVal = 3;
            if (searchString && searchString.length >= minInputVal) {
                var self = this;
                var roomType = this.room ? this.room.get('roomType') : 'private';
                var options = {
                    searchString: searchString,
                    roomType: roomType,
                    searchScope: this.searchScope,
                };

                var searchCollection = (options.searchScope === 'users') ? new searchUsers([],options) : new searchUsersOrGroups(options);
                searchCollection.fetch({
                    error: function(err) {
                        self.room.handleRequestError(err);
                    },
                    success: function() {
                        var $chatSearchResultHolder = self.$('#js_chat-search-result-holder');
                        var modal_type = $chatSearchResultHolder.data('type');
                        var room = modal_type === 'addPrivateRoom' ? null : self.room;
                        $chatSearchResultHolder.html(self.templateSearchResult({
                            users: (options.searchScope === 'users') ? searchCollection.models: searchCollection.get('users'),
                            rooms: (options.searchScope === 'users') ? [] : searchCollection.get('rooms'),
                            room: room,
                            type: modal_type,
                            templateUserAvatar: self.templateUserAvatar,
                            templateGroupAvatar: self.templateGroupAvatar
                            })
                        );
                    }
                });

            } else if (searchString && searchString.length > 0) {
                this.$('#js_chat-search-result-holder').html(
                    '<p class="chat-modal-empty-search">' +
                    '<span i18n="chat.notification.emptySearchResult">Minimum characters to search</span>'
                    + ': ' + minInputVal +
                    '</p>'
                );
            } else {
                this.$('#js_chat-search-result-holder').empty();
            }
        }, 400)
    };
});
