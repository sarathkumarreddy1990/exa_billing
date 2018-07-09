define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'shared/report-utils'
    , 'text!templates/reports/payment-report.html'
],
    function ($, _, Backbone, UI, paymentsTemplate) {

        var paymentsView = Backbone.View.extend({
            rendered: false,
            drpStudyDt: null,
            expanded: false,
            mainTemplate: _.template(paymentsTemplate),
            viewModel: {
                facilities: null,
                dateFrom: null,
                dateTo: null,
                allFacilities: false,
                facilityIds: null,
                openInNewTab: false,
                reportId: null,
                reportCategory: null,
                reportTitle: null,
                reportFormat: null,
                paymentOptions: null,
                billingProvider: null,
                allBillingProvider: false,
                allUsers: false,
                userIds: null,
                userNames: null,
                userRoleIds: null,
                UserRoleName: null
            },
            selectedBillingProList: [],
            selectedFacilityList: [],
            defaultyFacilityId: null,
            ACSelect: { user: {} },
            events: {

                'change #ddlUsersOption': 'onOptionChangeSelectUser',
                'change #ddlUsersRoleOption': 'onOptionChangeSelectUserRole',
                'click #btnViewReport': 'onReportViewClick',
                'click #btnViewReportNewTab': 'onReportViewClick',
                'click #btnPdfReport': 'onReportViewClick',
                'click #btnExcelReport': 'onReportViewClick',
                'click #btnCsvReport': 'onReportViewClick',
                'click #btnXmlReport': 'onReportViewClick'
            },

            initialize: function (options) {
                this.showForm();
                this.$el.html(this.mainTemplate(this.viewModel));
                UI.initializeReportingViewModel(options, this.viewModel);

                // Set date range to Facility Date
                this.viewModel.dateFrom = commonjs.getFacilityCurrentDateTime(app.facilityID);
                this.viewModel.dateTo = this.viewModel.dateFrom.clone();
            },

            showForm: function () {
                if (!this.rendered) {
                    this.render();
                }
                commonjs.initializeScreen({ header: { screen: this.viewModel.reportTitle, ext: this.viewModel.reportId } }); // html title
                UI.setPageTitle(this.viewModel.reportTitle);
            },

            render: function () {
                var modelCollection = Backbone.Collection.extend({
                    model: Backbone.Model.extend({})
                });
                this.viewModel.facilities = new modelCollection(commonjs.getCurrentUsersFacilitiesFromAppSettings());
                this.$el.html(this.mainTemplate(this.viewModel));

                this.bindDateRangePicker();
                this.drpStudyDt.setStartDate(this.viewModel.dateFrom);
                this.drpStudyDt.setEndDate(this.viewModel.dateTo);
                // For Facility Filter with Multiple Select
                $('#ddlFacilityFilter,  #ddlUsersOption, #ddlUsersRoleOption').multiselect({
                    maxHeight: 200,
                    buttonWidth: '300px',
                    width: '300px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });

                // For Payment Option select without Multiple filter
                $('#ddlPaymentOption, #ddlSummaryOption').multiselect({
                    maxHeight: '200px',
                    buttonWidth: '220px',
                    width: '200px'
                });
                // Binding Billing Provider MultiSelect
                UI.bindBillingProvider();
                UI.listUsersAutoComplete('Select Users', 'btnAddUsers', 'ulListUsers');
                UI.listUsersRoleAutoComplete('Select Users Role', 'btnAddUsersRole', 'ulListUsersRole');

            },

            bindDateRangePicker: function () {
                var self = this;
                var drpEl = $('#txtDateRangeFromTo');
                var drpOptions = { autoUpdateInput: true, locale: { format: 'L' } };
                this.drpStudyDt = commonjs.bindDateRangePicker(drpEl, drpOptions, 'past', function (start, end, format) {
                    self.viewModel.dateFrom = start;
                    self.viewModel.dateTo = end;
                });
                drpEl.on('cancel.daterangepicker', function (ev, drp) {
                    self.viewModel.dateFrom = null;
                    self.viewModel.dateTo = null;
                });
            },

            onOptionChangeSelectUser: function () {
                var self = this;
                if ($('#ddlUsersOption').val() == 'S') {
                    $("#ddlUsersBox").show();
                    $("#divUsers").show();
                    $('#txtUsers').text("Select User");
                }
                else {
                    $("#ddlUsersBox").hide();
                    $("#divUsers").hide();
                    this.viewModel.userNames = [];
                    this.viewModel.userIds = [];
                    $('#ulListUsers').data('this.viewModel.userIds', []);
                    $('#ulListUsers').html('');
                }
            },

            onOptionChangeSelectUserRole: function () {
                var self = this;
                if ($('#ddlUsersRoleOption').val() == 'S') {
                    $("#ddlUsersRoleBox").show();
                    $("#divUsersRole").show();
                    $('#txtUsersRole').text("Select User");
                }
                else {
                    $("#ddlUsersRoleBox").hide();
                    $("#divUsersRole").hide();
                    this.viewModel.userRoleNames = [];
                    this.viewModel.userRoleIds = [];
                    $('#ulListUsersRole').data('this.viewModel.userRoleIds', []);
                    $('#ulListUsersRole').html('');
                }
            },

            onReportViewClick: function (e) {
                var btnClicked = e && e.target ? $(e.target) : null;
                this.getSelectedFacility();
                this.getBillingProvider();
                if (btnClicked && btnClicked.prop('tagName') === 'I') {
                    btnClicked = btnClicked.parent(); // in case FA icon 'inside'' button was clicked...
                }
                var rFormat = btnClicked ? btnClicked.attr('data-rformat') : null;
                var openInNewTab = btnClicked ? btnClicked.attr('id') === 'btnViewReportNewTab' : false;
                this.viewModel.reportFormat = rFormat;
                this.viewModel.openInNewTab = openInNewTab && rFormat === 'html';
                this.viewModel.paymentOptions = $('#ddlPaymentOption').val();
                //if (this.hasValidViewModel()) {
                var urlParams = this.getReportParams();
                UI.showReport(this.viewModel.reportId, this.viewModel.reportCategory, this.viewModel.reportFormat, urlParams, this.viewModel.openInNewTab);
                //}             
            },


            hasValidViewModel: function () {
                if (this.viewModel.reportId == null || this.viewModel.reportCategory == null || this.viewModel.reportFormat == null) {
                    commonjs.showWarning('Please check report id, category, and/or format!');
                    return;
                }

                if (this.viewModel.dateFrom == null || this.viewModel.dateTo == null) {
                    commonjs.showWarning('Please select date range!');
                    return;
                }

                if ($('#ddlUsersOption').val() == 'S' && $('#ulListUsers li').length == 0) {
                    $('#txtUsers a span').val('Select User');
                    commonjs.showWarning('Please select at atleast one user');
                    return;
                }

                if ($('#ddlUsersRoleOption').val() == 'S' && $('#ulListUsersRole li').length == 0) {
                    $('#txtUsersRole a span').val('Select User Role');
                    commonjs.showWarning('Please select at atleast one user');
                    return;
                }
                return true;
            },

            setUsersAutoComplete: function () {
                var self = this;
                self.ACSelect.user.ID = "";
                self.ACSelect.user.username = "";
                commonjs.setAutocompleteInfinite({
                    containerID: "#txtSelectUser",
                    placeHolder: "user Details",
                    inputLength: 0,
                    URL: "/usersAutoCompleteBilling",
                    data: function (term, page) {
                        var textValue = $('#s2id_txtSelectUser a span').text();
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: "id",
                            sortOrder: "desc"

                        };
                    },

                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return { results: data.result, more: more };
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var user = '<div class="userListChkBox ddl"><input class="userListBox ddl" id=userList_' + res.userID + ' type="checkbox" name="allUserList" value="' + res.userID + '"><label class="checkbox-inline" id="billingProvider_' + res.userID + '" for="billingProvider_' + res.userID + '"> ' + res.user_name + '</label> </input></div>';
                        return user;
                    },
                    formatSelection: function (res) {
                        self.ACSelect.user.ID = res.id;
                        self.ACSelect.user.username = res.user_name;
                        if ($('#liFollowUpQueue').hasClass('active'))
                            self.setFollowUpGridArgs();
                        return res.user_name;

                    }
                });
                $('#txtSelectUser a span').html(app.userInfo.userFullName);
                self.ACSelect.user.ID = app.user_id;
                self.ACSelect.user.username = app.userInfo.userFullName;
                $('#s2id_txtSelectUser a span').html(app.userInfo.userFullName);
                $('#txtSelectUser').on('select2-removed', function (event) {
                    $('#txtSelectUser a span').html(self.usermessage.selectUser);
                    self.ACSelect.user.ID = "";
                    self.ACSelect.user.username = "";
                    $('#s2id_txtSelectUser a span').html(self.usermessage.selectUser);
                });
            },

            getSelectedFacility: function (e) {
                var selected = $("#ddlFacilityFilter option:selected");
                var facilities = [];
                selected.each(function () {
                    facilities.push($(this).val());
                });
                this.selectedFacilityList = facilities
                this.viewModel.allFacilities = this.selectedFacilityList && this.selectedFacilityList.length === $("#ddlFacilityFilter option").length;
            },

            // multi select billing provider - worked
            getBillingProvider: function (e) {
                var billing_pro = []
                var selected = $("#ddlBillingProvider option:selected");
                selected.each(function () {
                    billing_pro.push($(this).val());
                });
                this.selectedBillingProList = billing_pro;
                this.viewModel.allBillingProvider = this.selectedBillingProList && this.selectedBillingProList.length === $("#ddlBillingProvider option").length;
            },
            getReportParams: function () {
                var usersArray = [], userNameArray = [], usersRoleArray = [], userRoleNameArray = [];
                $('#ulListUsers li a').each(function () {
                    usersArray.push(~~$(this).attr('data-id'));
                    userNameArray.push($(this).closest('li').find('span').text());
                });

                $('#ulListUsersRole li a').each(function () {
                    usersRoleArray.push(~~$(this).attr('data-id'));
                    userRoleNameArray.push($(this).closest('li').find('span').text());
                });
                return urlParams = {
                    'userIds': $('#ddlUsersOption').val() == 'S' ? usersArray : '',
                    'userName': $('#ddlUsersOption').val() == 'S' ? userNameArray : '',
                    'userRoleIds': $('#ddlUsersRoleOption').val() == 'S' ? usersRoleArray : '',
                    'userRoleName': $('#ddlUsersRoleOption').val() == 'S' ? userRoleNameArray : '',
                    'facilityIds': this.selectedFacilityList ? this.selectedFacilityList : [],
                    'allFacilities': this.viewModel.allFacilities ? this.viewModel.allFacilities : '',
                    'fromDate': this.viewModel.dateFrom.format('YYYY-MM-DD'),
                    'toDate': this.viewModel.dateTo.format('YYYY-MM-DD'),
                    'billingProvider': this.selectedBillingProList ? this.selectedBillingProList : [],
                    'allBillingProvider': this.viewModel.allBillingProvider ? this.viewModel.allBillingProvider : '',
                    'billingProFlag': this.viewModel.allBillingProvider == 'true' ? true : false,
                    'summaryType': $('#ddlSummaryOption').val(),
                };
            }
        });

        return paymentsView;
    });
