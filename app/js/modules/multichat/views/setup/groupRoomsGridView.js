define(['jquery'
        , 'backbone'
        , 'underscore'
        , 'modules/multichat/collections/groupRooms'
        , 'models/pager'
        , 'text!modules/multichat/templates/setup/groupRoomsGrid.html'
        , 'modules/multichat/utils/errorHandler'
    ]
    , function ($
                , Backbone
                , _
                , GroupRoomCollection
                , GroupRoomPager
                , GroupRoomGrid
                , ErrorHandler
    ) {
        var groupRoomsGridView = Backbone.View.extend({
            el: null,
            pager: null,
            template: _.template(GroupRoomGrid),

            initialize: function ( options ) {
                _.extend(this, ErrorHandler);
                this.chatRooms = new GroupRoomCollection();
                this.pager = new GroupRoomPager();
                this.groupRoomTable = new customGrid();
                $('#divGrid_GroupRooms').hide();
            },

            showGrid: function () {
                var self = this;
                commonjs.updateCulture();
                this.render();
                var offsetHeight = (commonjs.currentModule=="Setup") ? '30' : '0';
                this.groupRoomTable.render({
                    gridelementid: '#tblGroupRoomsGrid',
                    custompager: self.pager,
                    stickysort: true,
                    stickysearch:true,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'chat.setup.fields.title','chat.setup.fields.users_count', 'chat.setup.fields.visibility_list_items_count'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true},
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/chatGroupRooms/edit/',
                            formatter: function () {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                commonjs.helpConfirm({
                                    icon: "fa fa-trash",
                                    hi18n: "messages.confirm.delete",
                                    bi18n: "messages.confirm.deleteAreYouSure",
                                    buttons: [
                                        {
                                            i18n: "messages.confirm.button.yes",
                                            click: function () {
                                                self.deleteRoom(rowID);
                                            }
                                        },
                                        {
                                            i18n: "messages.confirm.button.no"
                                        }
                                    ]
                                });
                            },
                            formatter: function () {
                                return "<span class='icon-ic-delete' rel='tooltip' title='Click here to delete'></span>"
                            }
                        },
                        { name: 'title', width: 300, searchFlag: '%'},
                        { name: 'users_count', width: 150, searchFlag: '%', stype: 'text'},
                        {
                            name: 'visibility_list_items_count',
                            width: 150,
                            searchFlag: '%',
                            stype: 'text',
                            formatter: function(value){
                                return value > 0 ? value : '';
                            }
                        }
                    ],
                    customizeSort: true,
                    pager: '#gridPager_GroupRooms',
                    sortname: "group_rooms_code",
                    sortorder: "asc",
                    caption: "Group Rooms",
                    datastore: this.chatRooms,
                    container: self.el,
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    offsetHeight: offsetHeight
                });
                commonjs.initializeScreen({
                    header: {
                        screen: 'Chat Group Rooms',
                        ext: 'ChatGroupRooms'
                    },
                    grid: {
                        id: '#tblGroupRoomsGrid'
                    },
                    buttons: [
                        {
                            value: 'Add',
                            class: 'btn btn-danger',
                            i18n: 'shared.buttons.add',
                            clickEvent: function () {
                                Backbone.history.navigate('#setup/chatGroupRooms/new', true);
                            }
                        },
                        {
                            value: 'Reload',
                            i18n: 'shared.buttons.reload',
                            class: 'btn', clickEvent: function () {
                                self.pager.set({"PageNo": 1});
                                self.groupRoomTable.refreshAll();
                            }}
                    ]
                });
                this.setAutocompleteColumns();
            },

            render: function () {
                $(this.el).html(this.template());
                commonjs.activatelink('Office');
            },

            backGroupRooms: function() {
                Backbone.history.navigate('#setup/chatGroupRooms/all', true);
            },

            setAutocompleteColumns: function(){
                this.setUsersAutoComplete('#gs_users_count', '/chat/users/search');
                this.setUsersAutoComplete('#gs_visibility_list_items_count', '/chat/users/search');
            },

            setUsersAutoComplete: function(containerId, url) {
                var self= this;
                commonjs.setAutocompleteInfinite({
                    containerID: containerId,
                    placeHolder: 'Select User',
                    inputLength: 3,
                    delay: 500,
                    URL: url,
                    autocomplete: 'on',
                    data: function (term, page) {
                        return {
                            name_substring: term,
                        };
                    },
                    results: function (data, page) {
                       return {results: data.result.users}
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        return commonjs.formatACResult(res.user_full_name, "", res.is_active);
                    },
                    formatSelection: function (res) {
                        return res.user_full_name;
                    }
                });
                $(containerId).on('change', function (e) {
                    // Send selected autocomplete data to hidden filter column
                    self.sendEnterKeyPressToHiddenColumn(containerId, e.val)
                });
            },

            sendEnterKeyPressToHiddenColumn: function(containerId, userId) {
                // Get a hidden input element
                var $filterInput = $(containerId);

                // Set userId to the a hidden input
                $filterInput.val(userId);

                // Send the keypress event with 'enter' button keycode
                var e = jQuery.Event('keypress');
                e.keyCode = e.which = 13;
                $filterInput.trigger(e);
            },

            deleteRoom: function(rowId) {
                var self = this;
                    $.ajax({
                        url: '/chat/rooms/' + rowId,
                        type: 'DELETE',
                        success: function (response, error) {
                            if (response.status == 'ok' && 'result' in response && 'rooms' in response.result) {
                                self.chatRooms.remove(rowId);
                                self.groupRoomTable.refreshAll();
                            } else {
                                commonjs.handleXhrError(error, response);
                            }
                        },
                        error: function (error) {
                            commonjs.handleXhrError(error);
                        }
                    });
            },
     });
        return groupRoomsGridView;
    });
