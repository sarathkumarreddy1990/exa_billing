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
            excelFlag: false,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new AuditLogModel();
                this.pager = new Pager();
                this.auditLogList = new AuditLogCollections();
                this.auditInfoList = new AuditLogCollections(true);
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
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
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
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-reports' title='Click here to view this log'></i>";
                            },
                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;'
                            },
                            customAction: function (rowID) {
                                self.displayDetails(rowID);
                            }
                        },
                        {
                            name: 'secure_data', width: 50, sortable: false, search: false, hidden: true,
                            className: 'icon-ic-secureData',
                            customAction: function (rowID) {

                            },

                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-secureData' title='Secure data'></span>";
                            },

                            cellattr: function () {
                                return 'style=text-align:center;cursor:pointer;';
                            }
                        },
                        {
                            name: 'created_dt',
                            width: 180,
                            formatter: function(e,model,data) {
                                return self.dateFormatter(data);
                            },
                            search: false
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
                    ondblClickRow: function (rowID) {
                        self.displayDetails(rowID);
                    },
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
                        from_date: self.dtpFrom && self.dtpFrom.date() ? self.dtpFrom.date().format() : "",
                        to_date: self.dtpTo && self.dtpTo.date() ? self.dtpTo.date().format() : "",
                        flag: self.excelFlag ? true : false
                    }
                });

                commonjs.initializeScreen({
                    header: { screen: 'AuditLog', ext: 'auditLog' }, grid: { id: '#tblAuditLogGrid' }, buttons: [
                        {
                            value: 'Export To Excel', class: 'btn btn-danger', i18n: 'shared.buttons.exportToExcel', clickEvent: function () {
                                self.exportExcel();
                            }
                        },
                        {
                            value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                                self.auditLogTable.options.customargs = {
                                    from_date: self.dtpFrom.date().format(),
                                    to_date: self.dtpTo.date().format()
                                }
                                self.pager.set({ "PageNo": 1 });
                                self.auditLogTable.refreshAll();
                                commonjs.showStatus("messages.status.reloadedSuccessfully");
                            }
                        }
                    ]
                });
            },

            showGrid: function () {
                this.render();
            },

            dateFormatter: function (rowObject) {
                return rowObject.created_dt ? commonjs.getFormattedDateTime(rowObject.created_dt) : '';
            },

            displayDetails: function (id) {
                var self = this;
                this.model.set({ id: id });
                this.model.fetch({
                    data: { id: this.model.id },
                    success: function (model, response) {
                        response = response[0];
                        commonjs.showDialog({
                            'header': 'Log Details',
                            'i18nHeader': 'setup.log.logDetails',
                            'width': '50%',
                            'height': '70%',
                            'needShrink': true,
                            'html': self.auditLogDetailsTemplate
                        });
                        $("#showDetailsRow").hide();
                        $("#oldInfoRow").hide();
                        if (response.changes && response.changes.old_values && Object.keys(response.changes.old_values).length) {
                            $("#showDetailsRow").show();
                            for (element in response.changes.old_values) {
                                if (element.toLowerCase() != 'id' && element.toLowerCase() != 'template_content') {
                                    var html = "<tr>" +
                                        "<td>" + element + "</td>" +
                                        "<td>" + response.changes.old_values[element] + "</td>" +
                                        "<td>" + response.changes.new_values[element] + "</td>" +
                                        "</tr>";
                                    $("#chngTblBdy").append(html);
                                }
                            }
                        }
                        $("#userName").html(response.username);
                        $("#clientIp").html(response.client_ip);
                        $("#module").html(response.module_name);
                        $("#screen").html(response.screen_name);
                        $("#loggedDate").html(self.dateFormatter(response));
                        $("#description").html(response.description);
                        $("#showDetails").click(function () {
                            $("#oldInfoRow").toggle();
                        });
                    }
                });
            },

            initializeDateTimePickers: function () {
                var companyCurrentDateTime = commonjs.getCompanyCurrentDateTime();
                var startFrom = moment(companyCurrentDateTime).subtract(5, 'days').startOf('day');
                var endTo = moment(companyCurrentDateTime).endOf('day');
                if (moment(companyCurrentDateTime).hour() >= 23) endTo.add(1, 'day');
                //this.dtpOptions.timeZone = commonjs.getCompanyTimeZone();
                this.dtpFrom = commonjs.bindDateTimePicker('divFromDate', { format: 'L LT' }, this.dtpOptions);
                this.dtpFrom.date(startFrom);
                this.dtpTo = commonjs.bindDateTimePicker('divToDate', { format: 'L LT' }, this.dtpOptions);
                this.dtpTo.date(endTo);
                commonjs.isMaskValidate();
            },

            exportExcel: function() {
                var self = this;
                self.excelFlag = true;
                var self = this;
                var responseJSON = self.auditLogList;
                var ReportTitle = 'Audit Log';
                var ShowLabel = 'Audit';
                var auditExcelData = typeof responseJSON != 'object' ? JSON.parse(responseJSON) : responseJSON;
                var CSV = '';
                CSV += ReportTitle + '\r';
                if (ShowLabel) {
                    var row = "";

                    row += 'LOGGED DATE' + ',';
                    row += 'SCREEN' + ',';
                    row += 'USER' + ',';
                    row += 'LOG DESCRIPTION' + ',';
                }
                row = row.slice(0, -1);
                CSV += row + '\r\n';

                for (var i = 0; i < auditExcelData.models.length; i++) {
                    var row = "";
                    var auditResult = auditExcelData.models[i].attributes;
                    row += '"' + moment(auditResult.created_dt).format('L') + '",';
                    row += '"' + auditResult.screen_name + '",';
                    row += '"' + auditResult.username + '",';
                    row += '"' + auditResult.description + '",';
                    row.slice(0, row.length - 1);
                    CSV += row + '\r\n';
                }

                if (CSV == '') {
                    alert("Invalid data");
                    return;
                }
                var fileName = "";
                fileName += ReportTitle.replace(/ /g, "_");
                var uri = 'data:text/csv;charset=utf-8,' + escape(CSV);
                var link = document.createElement("a");
                link.href = uri;
                link.style = "visibility:hidden";
                link.download = fileName + ".csv";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

        });
        return AuditLogView;
    });



