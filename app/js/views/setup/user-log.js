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
            isCleared: false,

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
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '',''],
                    i18nNames: ['', '', 'setup.common.user', 'setup.log.loggedDate_Grid' ,'setup.userLog.screenName','setup.userLog.clientIP', 'setup.log.logSource'],
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
                                return "<i class='icon-ic-reports' i18nt='messages.status.clickHereToViewThisLog'></i>";
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
                            formatter: function(e,model,rowObject) {
                                return self.dateFormatter(rowObject.logged_in_dt);
                            }
                        },
                        {
                            name: 'screen_name',
                            search: false,
                            width: 180
                        },
                        {
                            name: 'client_ip',
                            width: 180
                        },
                        {
                            name: 'module_name',
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
                    pager: '#gridPager_UserLog',
                    customargs: {
                        options: {
                            isCompanyBase: true
                        },
                        toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                        fromDate: !self.isCleared ? moment().subtract(2, 'days').format('YYYY-MM-DD') : ""
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.bindDateRangeOnSearchBox(gridObj);
                    }

                });

                commonjs.initializeScreen({header: {screen: 'UserLog', ext: 'userLog'}, grid: {id: '#tblUserLogGrid'}, buttons: [
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.userLogTable.refreshAll();
                        commonjs.showStatus("messages.status.reloadedSuccessfully");
                    }}
                ]});


            },

            showGrid: function (id) {
                this.render();
            },

            dateFormatter: function (_date) {
                return commonjs.checkNotEmpty(_date) ? commonjs.getFormattedDateTime(_date) : '';
            },

            //Bind the default date range on logged-in date column
            searchUserLog: function () {
                var self = this;
                self.pager.set({"PageNo": 1});
                self.userLogTable.options.customargs = {
                    options: {
                        isCompanyBase: true
                    },
                    toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                    fromDate: !self.isCleared ? moment().subtract(2, 'days').format('YYYY-MM-DD') : ""
                };
                self.userLogTable.refresh();
            },

            //Bind the date range filter
            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this;
                var columnsToBind = ['logged_in_dt'];
                var drpOptions = {
                    locale: {
                        format: "L"
                    }
                };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var colSelector = '#gs_' + col;
                    var colElement = $(colSelector);

                    if (!colElement.val() && !self.isCleared) {
                        var toDate = moment(),
                            fromDate = moment().subtract(2, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, "past", function (start, end, format) {
                        if (start && end) {
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }
                    });
                    colElement.on("apply.daterangepicker", function (obj) {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.isCleared = true;
                        self.searchUserLog();
                    });
                });
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
                            'i18nHeader': 'setup.log.logDetails',
                            'width': '50%',
                            'height': '60%',
                            'needShrink': true ,
                            'html':self.userLogDetailsTemplate
                        });
                        var clientInfo = commonjs.hstoreParse(response.detailed_info);
                        $("#userName").html(response.username);
                        $("#logInDt").html(self.dateFormatter(response.logged_dt));
                        $("#screenName").html(response.screen_name);
                        $("#browser").html(clientInfo.browser);
                        $("#browserVersion").html(clientInfo.browserversion);
                        $("#operatingSystem").html(clientInfo.os);
                    }
                });
            }
        });
        return UserLogView;
    });



