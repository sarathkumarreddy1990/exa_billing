define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/audit-log-grid.html',
    'text!templates/setup/audit_log_details.html',
    'collections/setup/audit-log',
    'models/setup/audit-log',
    'models/pager'
]
    , function ($, _, Backbone, JQGrid, JGridLocale, AuditLogGrid, AuditLogDetails, AuditLogCollections, AuditLogModel, Pager) {
        var AuditLogView = Backbone.View.extend({
            auditLogGridTemplate: _.template(AuditLogGrid),
            auditLogDetailsTemplate: _.template(AuditLogDetails),
            auditLogList: [],
            model: null,
            auditLogTable: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new AuditLogModel();
                this.pager = new Pager();
                this.auditLogList = new AuditLogCollections();
            },

            render: function () {
                var self = this;
                $('#divAuditLogGrid').show();
                $(this.el).html(this.auditLogGridTemplate());
                this.auditLogTable = new customGrid();
                self.initializeDateTimePickers();
                this.auditLogTable.render({
                    gridelementid: '#tblAuditLogGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.log.logDt', 'setup.common.screen', 'setup.common.user', 'setup.log.logDescription'],
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
                            route: '#setup/audit_log/view/',
                            formatter: function (e, model, data) {
                                return `<span class='icon-ic-reports' title='click here to view this log'></span>`;
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
                            }
                        },
                        {
                            name: 'secure_data', width: 50, sortable: false, search: false,
                            className: 'icon-ic-secureData',
                            customAction: function (rowID) {

                            },

                            formatter: function (e, model, data) {
                                return `<span class='icon-ic-secureData' title='secure data'></span>`;
                            },

                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;';
                            }
                        },
                        {
                            name: 'created_dt',
                            width: 180
                        },
                        {
                            name: 'screen_name',
                            width: 180
                        },
                        {
                            name: 'username',
                            width: 180
                        },
                        {
                            name: 'description',
                            width: 180
                        }
                    ],
                    datastore: self.auditLogList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "al.id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblAuditLogGrid,#jqgh_tblAuditLogGrid_view,#jqgh_tblAuditLogGrid_secure'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_AuditLog',
                    customargs: {
                        fromDate: self.dtpFrom && self.dtpFrom.date() ? self.dtpFrom.date().format() : "",
                        toDate: self.dtpTo && self.dtpTo.date() ? self.dtpTo.date().format() : ""
                    }
                });

                commonjs.initializeScreen({header: {screen: 'AuditLog', ext: 'auditLog'}, grid: {id: '#tblAuditLogGrid'}, buttons: [
                    {value: 'Export To Excel', class: 'btn btn-danger', i18n: 'shared.buttons.exportToExcel', clickEvent: function () {

                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.auditLogTable.options.customargs = {
                            fromDate: self.dtpFrom.date().format(),
                            toDate: self.dtpTo.date().format()
                        }
                        self.pager.set({"PageNo": 1});
                        self.auditLogTable.refreshAll();
                        commonjs.showStatus("Reloaded Successfully");
                    }}
                ]});
            },

            showGrid: function () {
                this.render();
            },

            showDetails: function (id) {
                this.displayDetails(id);
            },

            displayDetails: function (id) {
                var self = this;
                this.model.set({id: id});
                this.model.fetch({
                    data: { id: this.model.id},
                    success: function (model, response) {
                        response = response[0];
                        commonjs.showDialog({
                            'header': 'Log Details',
                            'width': '50%',
                            'height': '60%',
                            'needShrink': true,
                            'html': self.auditLogDetailsTemplate
                        });
                        $("#userName").html(response.username);
                        $("#clientIp").html(response.client_ip);
                        $("#module").html(response.module_name);
                        $("#screen").html(response.screen_name);
                        $("#loggedDate").html(response.created_dt);
                        $("#description").html(response.description);
                    }
                });
            },

            initializeDateTimePickers: function () {
                var companyCurrentDateTime = commonjs.getCompanyCurrentDateTime();
                var startFrom = moment(companyCurrentDateTime).subtract(5, 'days').startOf('day');
                var endTo = moment(companyCurrentDateTime).endOf('day');
                if (moment(companyCurrentDateTime).hour() >= 23) endTo.add(1, 'day');
                //this.dtpOptions.timeZone = commonjs.getCompanyTimeZone();
                this.dtpFrom = commonjs.bindDateTimePicker('divFromDate', this.dtpOptions);
                this.dtpFrom.date(startFrom);
                this.dtpTo = commonjs.bindDateTimePicker('divToDate', this.dtpOptions);
                this.dtpTo.date(endTo);
            }


        });
        return AuditLogView;
    });



