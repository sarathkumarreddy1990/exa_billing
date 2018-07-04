define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/user-log-grid.html',
    'text!templates/setup/user_log_details.html',
    'collections/setup/user-log',
    'models/setup/user-log',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, UserLogGrid, UserLogDetails, UserLogCollections, UserLogModel, Pager) {
        var UserLogView = Backbone.View.extend({
            userLogGridTemplate: _.template(UserLogGrid),
            userLogDetailsTemplate: _.template(UserLogDetails),
            userLogList: [],
            model: null,
            userLogTable: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new UserLogModel();
                this.pager = new Pager();
                this.userLogList = new UserLogCollections();
            },

            render: function () {
                var self = this;
                $('#divUserLogGrid').show();
                $(this.el).html(this.userLogGridTemplate());
                this.userLogTable = new customGrid();
                this.userLogTable.render({
                    gridelementid: '#tblUserLogGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', 'setup.common.user', 'setup.log.logInDt' , 'setup.log.logOutDt', 'setup.log.lastAccessed', 'setup.log.logSource'],
                    colModel: [
                        {
                            name: 'id',
                            index: 'id',
                            key: true,
                            hidden: true,
                            search: false
                        },
                        {
                            name: 'view',
                            width: 50,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-reports',
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-reports' title='click here to view this log'></span>";
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
                            },
                            customAction: function(rowID){
                                self.displayDetails(rowID) ;
                            }
                        },
                        {
                            name: 'username',
                            width: 180
                        },
                        {
                            name: 'logged_in_dt',
                            width: 180,
                            formatter: self.loggedIndateFormatter
                        },
                        {
                            name: 'logged_out_dt',
                            width: 180,
                            formatter: self.loggedOutdateFormatter
                        },
                        {
                            name: 'last_access_dt',
                            width: 180,
                            formatter: self.accessdateFormatter
                        },
                        {
                            name: 'login_source',
                            width: 180
                        }
                    ],
                    ondblClickRow: function (rowID) {
                        self.displayDetails(rowID);
                    },
                    datastore: self.userLogList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblUserLogGrid,#jqgh_tblUserLogGrid_view,#jqgh_tblUserLogGrid_secure'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_UserLog'
                });

                commonjs.initializeScreen({header: {screen: 'UserLog', ext: 'userLog'}, grid: {id: '#tblUserLogGrid'}, buttons: [
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.userLogTable.refreshAll();
                        commonjs.showStatus("Reloaded Successfully");
                    }}
                ]});


            },

            showGrid: function (id) {
                this.render();
            },

            loggedIndateFormatter: function (cellvalue, options, rowObject) {
                return commonjs.checkNotEmpty(rowObject.logged_in_dt) ? commonjs.getFormattedDateTime(rowObject.logged_in_dt) : '';
            },

            loggedOutdateFormatter: function (cellvalue, options, rowObject) {
                return commonjs.checkNotEmpty(rowObject.logged_out_dt) ? commonjs.getFormattedDateTime(rowObject.logged_out_dt) : '';
            },

            accessdateFormatter: function (cellvalue, options, rowObject) {
                return commonjs.checkNotEmpty(rowObject.last_access_dt) ? commonjs.getFormattedDateTime(rowObject.last_access_dt) : '';
            },

            displayDetails: function(id){
                var self=this;
                this.model.set({id: id});
                this.model.fetch({
                    data: { id: this.model.id},
                    success: function (model, response) {
                        response = response[0];
                        commonjs.showDialog({
                            'header': 'Log Details',
                            'width': '50%',
                            'height': '60%',
                            'needShrink': true ,
                            'html':self.userLogDetailsTemplate
                        });
                        var clientInfo = commonjs.hstoreParse(response.client_info);
                        $("#userName").html(response.username);
                        $("#logInDt").html(response.logged_in_dt);
                        $("#logOutDt").html(response.logged_out_dt);
                        $("#lastAccessedDt").html(response.last_access_dt);
                        $("#browser").html(clientInfo.browser);
                        $("#browserVersion").html(clientInfo.browserversion);
                        $("#operatingSystem").html(clientInfo.os);
                    }
                });
            }
        });
        return UserLogView;
    });



