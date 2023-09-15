define(['jquery'
        , 'backbone'
        , 'underscore'
        , 'modules/multichat/models/rooms'
        , 'text!modules/multichat/templates/setup/groupRoomsForm.html'
        , 'modules/multichat/utils/utils'
        , 'modules/multichat/utils/errorHandler'
    ]
    , function ($
        , Backbone
        , _
        , Rooms
        , GroupRoomForm
        , Utils
        , ErrorHandler
    ) {
        var groupRoomsEditFormView = Backbone.View.extend({
            template: _.template(GroupRoomForm),
            usermessage: {
                selectUser: "Select User",
            },
            events: {
                'click #btnAddGroupRoomMembers': 'addGroupRoomMembers',
                'click #btnAddGroupRoomVisibility': 'addGroupRoomVisibility',
                'click #btnClearChatGroupRooms': 'resetForm'
            },

            initialize: function () {
                _.extend(this, ErrorHandler);
                this.rooms = new Rooms.RoomsCollection(null, {usersCache: app.chat.chatModel._usersCache});
                commonjs.initializeScreen({
                    header: {
                        screen: 'Chat Group Rooms',
                        ext: 'ChatGroupRooms'
                    }, grid: {
                        id: '#tblGroupRoomsGrid'
                    },
                    buttons: []
                });
            },

            showForm: function (options) {
                var self = this;
                var chatRoomID = options.id;
                this.room = new Rooms.SetupRoomModel(null, {usersCache: app.chat.chatModel._usersCache, id: options.id});
                if(chatRoomID){
                    this.room.fetch();
                    self.chatRoomID = parseInt(chatRoomID);
                    self.operation = 'edit';
                } else {
                    self.chatRoomID = 0;
                    self.operation = 'create';
                }

                this.render();

                self.setUsersAutoComplete('groupRoomMembers', 'btnAddGroupRoomMembers', 'ulGroupRoomsMembers');
                self.setUsersAutoComplete('usersGroupVisibility', 'btnAddGroupRoomVisibility', 'ulGroupVisibility');

                this.resetForm();
                if (chatRoomID > 0) {
                    this.fetchRoom(chatRoomID, function (room) {
                        if (room) {
                            $('#txtGroupRoomsName').val(room.attributes.title);
                        }
                    });

                    $.ajax({
                        url: '/chat/rooms/' + self.chatRoomID + '/users/visibility',
                        type: 'GET',
                        success: function (response, error) {
                            if (response.status == 'ok' && 'result' in response && 'users' in response.result) {
                                self.visibilityList = response.result;
                                self.visibilityList.users.forEach(function(user){
                                    user.id = user.user_id;
                                });
                                self.fillUsers(self.visibilityList.users, 'ulGroupVisibility');
                            } else {
                                commonjs.handleXhrError(error, response);
                            }
                        },
                        error: function (error) {
                            commonjs.handleXhrError(error);
                        }
                    });

                    $.ajax({
                        url: '/chat/rooms/' + self.chatRoomID + '/users/',
                        type: 'GET',
                        success: function (response, error) {
                            if (response.status == 'ok' && 'result' in response && 'users' in response.result) {
                                self.members = response.result;
                                self.fillUsers(self.members.users, 'ulGroupRoomsMembers');
                            } else {
                                commonjs.handleXhrError(error, response);
                            }
                        },
                        error: function (error) {
                            commonjs.handleXhrError(error);
                        }
                    });
                }
                $('#divGrid_GroupRooms').hide();
                commonjs.initializeScreen({
                    header: {
                        screen: 'Chat Group Rooms',
                        ext: 'ChatGroupRooms'
                    },
                    buttons: [
                        {
                            value: 'Save',
                            type: 'submit',
                            class: 'btn btn-primary',
                            i18n: 'shared.buttons.save',
                            clickEvent: function () {
                                var postFields = {
                                    roomType: 'group',
                                    title: self.getRoomTitle(),
                                    users: $("#ulGroupRoomsMembers").data('selection') || [],
                                    usersVisibility: $("#ulGroupVisibility").data('selection') || [],
                                };
                                if(self.operation === 'create'){
                                    if (self.validateRoomTitle(postFields.title)) {
                                        self.disableSaveButton();
                                        self.rooms.createRoom(postFields, function (resCreate) {
                                            if(self.enableSaveButton(resCreate, 'chat.errors.addRoom') === false)
                                                return;
                                            self.room.set('id', resCreate);
                                            self.room.set('visibilityUsers', new Backbone.Collection());
                                            self.room.updateVisibilityUsersByIds(postFields.usersVisibility, function (resVisibility) {
                                                if (self.enableSaveButton(resVisibility, 'chat.errors.addRoom', 'chat.notification.chatGroupRoomAdded')){
                                                    self.backGroupRooms();
                                                }
                                            });
                                        });
                                    }
                                } else {
                                    if (self.validateRoomTitle(postFields.title)) {
                                        self.disableSaveButton();
                                        self.room.setTitle(postFields.title, function (resTitle) {
                                            if(self.enableSaveButton(resTitle, 'chat.errors.someerror') === false)
                                                return;
                                            self.room.updateVisibilityUsersByIds(postFields.usersVisibility, function (resVisibility) {
                                                if(self.enableSaveButton(resVisibility, 'chat.errors.someerror') === false)
                                                    return;
                                                self.room.updateMembersByIds(postFields.users, function (resMembers) {
                                                    if(self.enableSaveButton(resMembers, 'chat.errors.someerror', 'chat.notification.chatGroupRoomUpdated')){
                                                        self.backGroupRooms()
                                                    }
                                                });
                                            });
                                        });
                                    }
                                }
                            }
                        },
                        {
                            value: 'Clear',
                            class: 'btn',
                            i18n: 'shared.buttons.clear',
                            clickEvent: function () {
                                self.resetForm();
                            }
                        },
                        {
                            value: 'Back',
                            class: 'btn',
                            i18n: 'shared.buttons.back',
                            clickEvent: function () {
                                self.backGroupRooms();
                            }
                        }
                    ]
                });
                if (chatRoomID > 0) {
                    $('#btnClearChatGroupRooms').hide();
                }
            },

            fetchRoom: function(id, cb){
                var self = this;
                $.ajax({
                    url: '/chat/rooms/' + id,
                    type: 'GET',
                    success: function (response, error) {
                        if (response.status == 'ok' && 'result' in response && 'room' in response.result) {
                            response.result.rooms = [response.result.room];
                            self.rooms.addRooms(response);
                            if(typeof cb === 'function'){
                                cb(self.rooms.find({id: id}))
                            }
                        } else {
                            commonjs.handleXhrError(error, response);
                        }
                    },
                    error: function (error) {
                        commonjs.handleXhrError(error);
                    }
                });
            },

            setUsersAutoComplete: function (id, buttonId, ulId) {
                var self = this,
                    $buttonId = $('#' + buttonId),
                    $ulId = $('#' + ulId);

                commonjs.setAutocompleteInfinite({
                    containerID: '#' + id,
                    placeHolder: self.usermessage.selectUser,
                    inputLength: 3,
                    delay: 500,
                    URL: "/chat/users/search",
                    data: function (term) {
                        return {
                            name_substring: term,
                            userGroups: true,
                        };
                    },
                    results: function (data) {
                        return {results: data.result.users}
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var userName = res.user_full_name + ' (' + res.group_name + ')';
                        return commonjs.formatACResult(userName, "", res.is_active);
                    },
                    formatSelection: function (res) {
                        $buttonId.data('userIdAdded', ~~res.id);
                        $buttonId.data('userNameAdded', res.user_full_name);
                        return res.user_full_name;
                    }
                });

                $('#' + id).on('select2-removed', function () {
                    $buttonId.data('userIdAdded', null);
                    $buttonId.data('userNameAdded', null);
                    $('#s2id_' + id + ' a span').html(self.usermessage.selectUser);
                });

                // it's called 'selection' for commonjs.resetAutocompleteMultiSelection
                $ulId.on('click', 'a.remove', function () {
                    var idsList = $ulId.data('selection') || [];
                    var idRemoved = $(this).attr('data-id');
                    idsList = _.without(idsList, ~~idRemoved);
                    $ulId.data('selection', idsList);
                    $(this).closest('li').remove();
                    return;
                });
            },

            addGroupRoomMembers: function () {
                var btnAddGroupRoomMembers = $('#btnAddGroupRoomMembers');
                var userId = btnAddGroupRoomMembers.data('userIdAdded'),
                    userName = btnAddGroupRoomMembers.data('userNameAdded');

                if (this.addUser(userId, userName, 'ulGroupRoomsMembers')) {
                    $('#groupRoomMembers').select2('val', null);
                    btnAddGroupRoomMembers.removeData(['userIdAdded', 'userNameAdded']);
                }
            },

            addGroupRoomVisibility: function () {
                var btnAddGroupRoomVisibility = $('#btnAddGroupRoomVisibility');
                var userId = btnAddGroupRoomVisibility.data('userIdAdded'),
                    userName = btnAddGroupRoomVisibility.data('userNameAdded');

                if (this.addUser(userId, userName, 'ulGroupVisibility')) {
                    $('#usersGroupVisibility').select2('val', null);
                    btnAddGroupRoomVisibility.removeData(['userIdAdded', 'userNameAdded']);
                }
            },

            addUser: function (userId, userName, _ulId) {
                var ulId = $('#' + _ulId);
                var userIdsList = ulId.data('selection') || [];
                var userNamesList = ulId.data('userNames') || [];
                var userIdAdded = userId;
                var userNameAdded = userName;

                // Check to see if User already exists in the box
                if (_.includes(userIdsList, userIdAdded)) {
                    commonjs.showWarning('chat.errors.userAlreadyExists');
                    return false;
                }

                // Check to see if User is defined
                if (!userIdAdded || !userNameAdded) {
                    commonjs.showWarning('chat.errors.noUserSelected');
                    return false;
                }

                ulId.append('<li><span>' + userNameAdded + '</span><a class="remove" data-id="' + userIdAdded + '" id="' + userIdAdded + '" data-value="' + userNameAdded + '"><span class="icon-ic-close"></span></a></li>');
                userIdsList.push(~~userIdAdded);
                userNamesList.push(userNameAdded);
                ulId.data('selection', userIdsList);
                ulId.data('userNames', userNamesList);

                return true;
            },

            fillUsers: function (users, ulId) {
                var $ulId = $('#' + ulId);
                var userIdsList = [];
                var userNamesList = [];
                var membersList = '';

                users.forEach(function (user) {
                    membersList += '<li><span>' + user.user_full_name + '</span><a class="remove" data-id="'
                        + user.id + '" id="' + user.id + '" data-value="' + user.user_full_name
                        + '"><span class="icon-ic-close"></span></a></li>';
                    userIdsList.push(~~user.id);
                    userNamesList.push(user.user_full_name);
                });

                $ulId.append(membersList);
                $ulId.data('selection', userIdsList);
                $ulId.data('userNames', userNamesList);

                return true;
            },

            roomTitleChange: function () {
                var title = this.getRoomTitle();
                this.validateRoomTitle(title);
            },

            getRoomTitle: function () {
                var title = $('#txtGroupRoomsName').val();
                title = Utils.escapeHTML(_.trim(title));
                return title;
            },

            validateRoomTitle: function (title) {
                var chatPossessive = app.chat.chatModel.get('me').get('possessive');
                var titleCharMaxLimit = _.get(chatPossessive, 'limits.MAX_ROOM_TITLE_LENGTH');
                var titleCharMinLimit = _.get(chatPossessive, 'limits.MIN_ROOM_TITLE_LENGTH');

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
                return true;
            },

            render: function () {
                var ipForm = $(this.el).find('#divForm_GroupRooms');
                ipForm.html(this.template({}));
            },

            backGroupRooms: function () {
                Backbone.history.navigate('#setup/chatGroupRooms/all', true);
            },

            resetForm: function () {
                $('#txtGroupRoomsName').val('');
                commonjs.resetAutocompleteMultiSelection('#ulGroupRoomsMembers', {
                    ddlElement: '#usersGroupVisibility',
                    btnAddElement: '#btnAddGroupRoomMembers'
                });
                commonjs.resetAutocompleteMultiSelection('#ulGroupVisibility', {
                    ddlElement: '#usersGroupVisibility',
                    btnAddElement: '#btnAddGroupRoomVisibility'
                });
            },

            disableSaveButton: function() {
                $('#btnSaveChatGroupRooms').attr("disabled", true);
            },

            enableSaveButton: function (res, errNotify, successNotify) {
                if (res && typeof res === 'object' && 'status' in res && res.status !== 'ok') {
                    $('#btnSaveChatGroupRooms').attr("disabled", false);
                    if(errNotify) {
                        commonjs.showError(errNotify);
                    }
                    return false;
                }
                if(successNotify) {
                    commonjs.showStatus(commonjs.geti18NString(successNotify));
                }
                return true;
            }
        });

        return groupRoomsEditFormView;
    });
