define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/edi-clearinghouses-grid.html',
    'text!templates/setup/edi-clearinghouses-form.html',
    'collections/setup/edi-clearinghouses',
    'models/setup/edi-clearinghouses',
    'models/pager'
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        EDIClearingHousesGrid,
        EDIClearingHousesForm,
        EDIClearingHousesCollections,
        EDIClearingHousesModel,
        Pager
    ) {
        var EDIClearingHousesView = Backbone.View.extend({
            ediClearingHousesGridTemplate: _.template(EDIClearingHousesGrid),
            ediClearingHousesFormTemplate: _.template(EDIClearingHousesForm),
            ediClearingHousesList: [],
            model: null,
            ediClearingHousesTable: null,
            pager: null,
            events: {
                'change #ddlXmlTemplateSyntax' : 'changeXmlTemplateSyntax',
                'keyup #txtSubElementDelimiter': 'checkValidSubDelimiter',
                'keyup #txtElementDelimiter': 'checkValidDelimiter'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new EDIClearingHousesModel();
                this.pager = new Pager();
                this.ediClearingHousesList = new EDIClearingHousesCollections();
                $(this.el).html(this.ediClearingHousesGridTemplate());
            },

            render: function () {
                var self = this;
                $('#divEDIClearingHousesGrid').show();
                $('#divEDIClearingHousesForm').hide();
                this.ediClearingHousesTable = new customGrid();
                this.ediClearingHousesTable.render({
                    gridelementid: '#tblEDIClearingHousesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.ediClearingHouses.name', 'setup.ediClearingHouses.receiverName', 'is_active'],
                    colModel: [
                        {
                            name: 'id',
                            index: 'id',
                            key: true,
                            hidden: true,
                            search: false
                        },
                        {
                            name: 'edit',
                            width: 10,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/edi_clearinghouses/edit/',
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 10, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        success: function (model, response) {
                                            self.ediClearingHousesTable.refreshAll();
                                            commonjs.showStatus("Deleted Successfully");
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-delete' title='click Here to Delete'></span>"
                            }
                        },
                        {
                            name: 'name',
                            searchFlag: '%'
                        },
                        {
                            name: 'receiver_name',
                            searchFlag: '%'
                        },
                        {
                            name:'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblEDIClearingHousesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.ediClearingHousesList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblEDIClearingHousesGrid,#jqgh_tblEDIClearingHousesGrid_edit,#jqgh_tblEDIClearingHousesGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_EDIClearingHouses'
                });

                commonjs.initializeScreen({header: {screen: 'EDIClearingHouses', ext: 'ediClearingHouses'}, grid: {id: '#tblEDIClearingHousesGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/edi_clearinghouses/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.ediClearingHousesTable.refreshAll();
                        commonjs.showStatus("Reloaded Successfully");
                    }}
                ]});
            },
            showGrid: function () {
                this.render();
            },

            showForm: function (id) {
                var self = this;
                this.renderForm(id);
            },

            renderForm: function (id) {
                var self=this;
                $('#divEDIClearingHousesForm').html(this.ediClearingHousesFormTemplate());
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                if (data) {
                                    var info = data.communication_info;
                                    $('#txtName').val(data.name ? data.name : '');
                                    $('#txtCode').val(data.code ? data.code : '');
                                    $('#txtReceiverName').val(data.receiver_name ? data.receiver_name : '');
                                    $('#txtReceiverID').val(data.receiver_id ? data.receiver_id : '');
                                    $('#txtEdiTemplateName').val(data.edi_template_name ? data.edi_template_name : '');
                                    $('#chkIsActive').prop('checked', data.inactivated_dt ? true : false);
                                    $('#txtAuthInfo').val(info.authorizationInformation ? info.authorizationInformation : '');
                                    $('#txtAuthInfoQualifier').val(info.authorizationInformationQualifier ? info.authorizationInformationQualifier : '');
                                    $('#txtSecurityInfo').val(info.securityInformation ? info.securityInformation : '');
                                    $('#txtSecurityAuthQualifier').val(info.securityInformationQualifier ? info.securityInformationQualifier : '');
                                    $('#txtSenderID').val(info.interchangeSenderId ? info.interchangeSenderId : '');
                                    $('#txtSenderIDQualifier').val(info.interchangeSenderIdQualifier ? info.interchangeSenderIdQualifier : '');
                                    $('#txtIReceiverID').val(info.interchangeReceiverId ? info.interchangeReceiverId : '');
                                    $('#txtIReceiverIDQualifier').val(info.interchangeReceiverIdQualifier ? info.interchangeReceiverIdQualifier : '');
                                    $('#txtInterCtrlStandID').val(info.interchangeControlStandardsIdentifier ? info.interchangeControlStandardsIdentifier : '');
                                    $('#txtInterCtrlVersionNo').val(info.interchangeControlVersionNumber ? info.interchangeControlVersionNumber : '');
                                    $('#txtRepetitionSeperator').val(info.repetitionSeparator ? info.repetitionSeparator : '');
                                    $('#txtElementDelimiter').val(info.elementDelimiter ? info.elementDelimiter : '');
                                    $('#txtSubElementDelimiter').val(info.segmentDelimiter ? info.segmentDelimiter : '');
                                    $('#txtSegmentTerminator').val(info.segmentTerminator ? info.segmentTerminator : '');
                                    $('#chkAckReq').prop('checked', info.acknowledgementRequested ? true : false);
                                    $('input[value=' + info.usageIndicator + ']').prop('checked', true);
                                    $('#txtAppSenderCode').val(info.applicationSenderCode ? info.applicationSenderCode : '');
                                    $('#txtResAgencyCode').val(info.responsibleAgencyCode ? info.responsibleAgencyCode : '');
                                    $('#txtAppReceiverCode').val(info.applicationReceiverCode ? info.applicationReceiverCode : '');
                                    $('#txtVerRelIndIDCode').val(info.verRelIndIdCode ? info.verRelIndIdCode : '');
                                    $('#txtImplConventionReference').val(info.implementationConventionRef ? info.implementationConventionRef : '');
                                    $('#txtRequestUrl').val(info.requestURL ? info.requestURL : '');
                                    $('#txtBackupRootFolder').val(info.backupRootFolder ? info.backupRootFolder : '');
                                    $('#chkEnableB2B').prop('checked', info.isB2bEnabled ? true : false);
                                    $('#ddlXmlTemplateSyntax').val(info.xmlSyntaxTag ? info.xmlSyntaxTag : "");
                                    if (info.xmlSyntaxTag != '1' && info.xmlSyntaxTag != '') {
                                        $('.xmlTemplateSyntaxAuth').show();
                                        $('#txtProviderOfficeNo').val(info.providerOfficeNumber ? info.providerOfficeNumber : '');
                                        $('#txtUserName').val(info.userID ? info.userID : '');
                                        $('#txtPassword').val(info.password ? info.password : '');
                                    }
                                }
                            }     
                        }
                    });
                } else {
                    this.model = new EDIClearingHousesModel();

                }
                commonjs.initializeScreen({header: {screen: 'EDIClearingHouses', ext: 'ediClearingHouses'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        $("#txtCode").val($.trim($('#txtCode').val()) || null);
                        $("#txtName").val($.trim($('#txtName').val()) || null);
                        $("#txtReceiverName").val($.trim($('#txtReceiverName').val()) || null);
                        $("#txtReceiverID").val($.trim($('#txtReceiverID').val()) || null);
                        $("#txtEdiTemplateName").val($.trim($('#txtEdiTemplateName').val()) || null);
                        $("#txtAuthInfo").val($.trim($('#txtAuthInfo').val()) || null);
                        $("#txtAuthInfoQualifier").val($.trim($('#txtAuthInfoQualifier').val()) || null);
                        $("#txtSecurityInfo").val($.trim($('#txtSecurityInfo').val()) || null);
                        $("#txtSecurityAuthQualifier").val($.trim($('#txtSecurityAuthQualifier').val()) || null);
                        $("#txtSenderID").val($.trim($('#txtSenderID').val()) || null);
                        $("#txtSenderIDQualifier").val($.trim($('#txtSenderIDQualifier').val()) || null);
                        $("#txtIReceiverID").val($.trim($('#txtIReceiverID').val()) || null);
                        $("#txtIReceiverIDQualifier").val($.trim($('#txtIReceiverIDQualifier').val()) || null);
                        $("#txtInterCtrlStandID").val($.trim($('#txtInterCtrlStandID').val()) || null);
                        $("#txtAppSenderCode").val($.trim($('#txtAppSenderCode').val()) || null);
                        $("#txtResAgencyCode").val($.trim($('#txtResAgencyCode').val()) || null);
                        $("#txtAppReceiverCode").val($.trim($('#txtAppReceiverCode').val()) || null);
                        self.saveEDIClearingHouses();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/edi_clearinghouses/list', true);
                    }}
                ]});
                $('#divEDIClearingHousesGrid').hide();
                $('#divEDIClearingHousesForm').show();
                commonjs.processPostRender();
            },
            saveEDIClearingHouses : function() {
                var self = this;
                var rules = {
                    name: { required: true },
                    code: { required: true },
                    receiverName: { required: true },
                    receiverID: { required: true },
                    authInfoQualifier: { required: true },
                    authInfo: { required: true },
                    securityAuthInfoQualifier: {required: true},
                    securityAuthInfo: {required: true},
                    senderIDQualifier: {required: true},
                    senderID: {required: true},
                    iReceiverIDQualifier: {required: true},
                    iRecevierID: {required: true},
                    ctrlStandID: {required: true},
                    radUsage: {required: true},
                    appSenderCode: {required: true},
                    responsibleAgencyCode: {required: true},
                    appReceiverCode: {required: true},
                    providerOfficeNo: {required: true}
                }
                if ($('#ddlXmlTempSyn').val() != 1) {
                    rules.username = { required: true }
                    rules.password = { required: true }
                }
                commonjs.validateForm({
                    rules: rules,
                    messages: {
                        name: commonjs.getMessage("e", "Clearing House Name"),
                        code: commonjs.getMessage("e", "Code"),
                        receiverName: commonjs.getMessage("e", "Recevier Name"),
                        receiverID: commonjs.getMessage("e", "Recevier ID"),
                        authInfoQualifier: commonjs.getMessage("e", "Authorization Information Qualifier"),
                        authInfo: commonjs.getMessage("e", "Authorization Information"),
                        securityAuthInfoQualifier: commonjs.getMessage("e", "Security Information Qualifier"),
                        securityAuthInfo: commonjs.getMessage("e", "Security Information"),
                        senderIDQualifier: commonjs.getMessage("e", "Interchange Sender ID Qualifier"),
                        senderID: commonjs.getMessage("e", "Interchange Sender ID"),
                        iReceiverIDQualifier: commonjs.getMessage("e", "Interchange Receiver ID Qualifier"),
                        iRecevierID: commonjs.getMessage("e", "Interchange Receiver ID"),
                        ctrlStandID: commonjs.getMessage("e", "Interchange Control Standards Identifier"),
                        radUsage: commonjs.getMessage("*", "Usage"),
                        appSenderCode: commonjs.getMessage("e", "Application Sender Code"),
                        responsibleAgencyCode: commonjs.getMessage("e", "Responsible Agency Code"),
                        appReceiverCode: commonjs.getMessage("e", "Application Receiver Code"),
                        providerOfficeNo: commonjs.getMessage("e", "Provider Office No"),
                        username: commonjs.getMessage("e", "Username"),
                        password: commonjs.getMessage("e", "Password")
                    },
                    submitHandler: function () {
                        self.save();
                    },
                    formID: '#formEDIClearingHouses'
                });
                $('#formEDIClearingHouses').submit();
            },

            save: function () {
                var communication_info = {
                    authorizationInformation: $('#txtAuthInfo').val(),
                    authorizationInformationQualifier: $('#txtAuthInfoQualifier').val(),
                    securityInformation: $('#txtSecurityInfo').val(),
                    securityInformationQualifier: $('#txtSecurityAuthQualifier').val(),
                    interchangeSenderId: $('#txtSenderID').val(),
                    interchangeSenderIdQualifier: $('#txtSenderIDQualifier').val(),
                    interchangeReceiverId: $('#txtIReceiverID').val(),
                    interchangeReceiverIdQualifier: $('#txtIReceiverIDQualifier').val(),
                    interchangeControlStandardsIdentifier: $('#txtInterCtrlStandID').val(),
                    interchangeControlVersionNumber: $('#txtInterCtrlVersionNo').val(),
                    repetitionSeparator: $('#txtRepetitionSeperator').val(),
                    elementDelimiter: $('#txtElementDelimiter').val(),
                    segmentDelimiter: $('#txtSubElementDelimiter').val(),
                    segmentTerminator: $('#txtSegmentTerminator').val(),
                    acknowledgementRequested: $('#chkAckReq').prop('checked'),
                    usageIndicator: $('input[name="radUsage"]:checked').val(),
                    applicationSenderCode: $('#txtAppSenderCode').val(),
                    responsibleAgencyCode: $('#txtResAgencyCode').val(),
                    applicationReceiverCode: $('#txtAppReceiverCode').val(),
                    verRelIndIdCode: $('#txtVerRelIndIDCode').val(),
                    implementationConventionRef: $('#txtImplConventionReference').val(),
                    requestURL: $('#txtRequestUrl').val(),
                    backupRootFolder: $('#txtBackupRootFolder').val(),
                    isB2bEnabled: $('#chkEnableB2B').prop('checked'),
                    xmlSyntaxTag: $('#ddlXmlTemplateSyntax').val(),
                    userID: $('#txtUserName').val(),
                    password: $('#txtPassword').val(),
                    providerOfficeNumber: $('#txtProviderOfficeNo').val()
                }
                this.model.set({
                    "name": $('#txtName').val(),
                    "code": $('#txtCode').val(),
                    "receiverName": $('#txtReceiverName').val(),
                    "receiverId": $('#txtReceiverID').val(),
                    "ediTemplateName": $('#txtEdiTemplateName').val(),
                    "company_id": app.companyID,
                    "isActive": !$('#chkIsActive').prop('checked'),
                    "communicationInfo": JSON.stringify(communication_info)
                });
                this.model.save({
                }, {
                        success: function (model, response) {
                            if (response) {
                                commonjs.showStatus("Saved Successfully");
                                location.href = "#setup/edi_clearinghouses/list";
                            }
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response); 
                        }
                    });
            },

            changeXmlTemplateSyntax: function(e) {
                var templateSyntaxValue = $('#ddlXmlTemplateSyntax').val();
                if(templateSyntaxValue == 1) {
                    $('.xmlTemplateSyntaxAuth').hide();
                } else {
                    $('.xmlTemplateSyntaxAuth').show();
                }
             },

            checkValidSubDelimiter: function (e) {
                var val = $('#txtElementDelimiter').val().trim();
                if (val && e.key == val)$('#txtSubElementDelimiter').val('');
            },

            checkValidDelimiter: function (e) {
                var val = $('#txtSubElementDelimiter').val().trim();
                if (val && e.key == val)$('#txtElementDelimiter').val('');
            }
        });
        return EDIClearingHousesView;
    });



