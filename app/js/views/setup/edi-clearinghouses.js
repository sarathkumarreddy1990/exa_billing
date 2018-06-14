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
                'change #ddlXmlTemplateSyntax' : 'changeXmlTemplateSyntax'
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new EDIClearingHousesModel();
                this.pager = new Pager();
                this.ediClearingHousesList = new EDIClearingHousesCollections();
            },

            render: function () {
                var self = this;
                $('#divEDIClearingHousesGrid').show();
                $('#divEDIClearingHousesForm').hide();
                $(this.el).html(this.ediClearingHousesGridTemplate());
                this.ediClearingHousesTable = new customGrid();
                this.ediClearingHousesTable.render({
                    gridelementid: '#tblEDIClearingHousesGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.ediClearingHouses.name', 'setup.ediClearingHouses.receiverName'],
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
                            width: 20,
                            sortable: false,
                            search: false,
                            className: 'icon-ic-edit',
                            route: '#setup/edi_clearinghouses/edit/',
                            formatter: function (e, model, data) {
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
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
                            width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'receiver_name',
                            width: 180,
                            searchFlag: '%'
                        }
                    ],
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
                                    $('#chkActive').prop('checked', data.inactivated_dt ? true : false);
                                    $('#txtAuthInfo').val(info.AuthorizationInformation ? info.AuthorizationInformation : '');
                                    $('#txtAuthInfoQualifier').val(info.AuthorizationInformationQualifier ? info.AuthorizationInformationQualifier : '');
                                    $('#txtSecurityInfo').val(info.SecurityInformation ? info.SecurityInformation : '');
                                    $('#txtSecurityAuthQualifier').val(info.SecurityInformationQualifier ? info.SecurityInformationQualifier : '');
                                    $('#txtSenderID').val(info.InterchangeSenderId ? info.InterchangeSenderId : '');
                                    $('#txtSenderIDQualifier').val(info.InterchangeSenderIdQualifier ? info.InterchangeSenderIdQualifier : '');
                                    $('#txtIReceiverID').val(info.InterchangeReceiverId ? info.InterchangeReceiverId : '');
                                    $('#txtIReceiverIDQualifier').val(info.InterchangeReceiverIdQualifier ? info.InterchangeReceiverIdQualifier : '');
                                    $('#txtInterCtrlStandID').val(info.InterchangeControlStandardsIdentifier ? info.InterchangeControlStandardsIdentifier : '');
                                    $('#txtInterCtrlVersionNo').val(info.InterchangeControlVersionNumber ? info.InterchangeControlVersionNumber : '');
                                    $('#txtRepetitionSeperator').val(info.RepetitionSeparator ? info.RepetitionSeparator : '');
                                    $('#txtElementDelimiter').val(info.ElementDelimiter ? info.ElementDelimiter : '');
                                    $('#txtSubElementDelimiter').val(info.SegmentDelimiter ? info.SegmentDelimiter : '');
                                    $('#txtSegmentTerminator').val(info.SegmentTerminator ? info.SegmentTerminator : '');
                                    $('#chkAckReq').prop('checked', info.AcknowledgementRequested ? true : false);
                                    $(`input[value=${info.UsageIndicator}]`).prop('checked', true);
                                    $('#txtAppSenderCode').val(info.ApplicationSenderCode ? info.ApplicationSenderCode : '');
                                    $('#txtResAgencyCode').val(info.ResponsibleAgencyCode ? info.ResponsibleAgencyCode : '');
                                    $('#txtAppReceiverCode').val(info.ApplicationReceiverCode ? info.ApplicationReceiverCode : '');
                                    $('#txtVerRelIndIDCode').val(info.VerRelIndIdCode ? info.VerRelIndIdCode : '');
                                    $('#txtImplConventionReference').val(info.ImplementationConventionRef ? info.ImplementationConventionRef : '');
                                    $('#txtRequestUrl').val(info.RequestURL ? info.RequestURL : '');
                                    $('#txtBackupRootFolder').val(info.BackupRootFolder ? info.BackupRootFolder : '');
                                    $('#chkEnableB2B').prop('checked', info.IsB2bEnabled ? true : false);
                                    $('#ddlXmlTemplateSyntax').val(info.XmlSyntaxTag ? info.XmlSyntaxTag : "");
                                    if (info.XmlSyntaxTag != '1' && info.XmlSyntaxTag != '') {
                                        $('.xmlTemplateSyntaxAuth').show();
                                        $('#txtProviderOfficeNo').val(info.ProviderOfficeNumber ? info.ProviderOfficeNumber : '');
                                        $('#txtUserName').val(info.UserID ? info.UserID : '');
                                        $('#txtPassword').val(info.Password ? info.Password : '');
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
                        name: commonjs.getMessage("*", "Clearing House Name"),
                        code: commonjs.getMessage("*", "Code"),
                        receiverName: commonjs.getMessage("*", "Recevier Name"),
                        receiverID: commonjs.getMessage("*", "Recevier ID"),
                        authInfoQualifier: commonjs.getMessage("*", "Authorization Information Qualifier"),
                        authInfo: commonjs.getMessage("*", "Authorization Information"),
                        securityAuthInfoQualifier: commonjs.getMessage("*", "Security Information Qualifier"),
                        securityAuthInfo: commonjs.getMessage("*", "Security Information"),
                        senderIDQualifier: commonjs.getMessage("*", "Interchange Sender ID Qualifier"),
                        senderID: commonjs.getMessage("*", "Interchange Sender ID"),
                        iReceiverIDQualifier: commonjs.getMessage("*", "Interchange Receiver ID Qualifier"),
                        iRecevierID: commonjs.getMessage("*", "Interchange Receiver ID"),
                        ctrlStandID: commonjs.getMessage("*", "Interchange Control Standards Identifier"),
                        radUsage: commonjs.getMessage("*", "Usage"),
                        appSenderCode: commonjs.getMessage("*", "Application Sender Code"),
                        responsibleAgencyCode: commonjs.getMessage("*", "Responsible Agency Code"),
                        appReceiverCode: commonjs.getMessage("*", "Application Receiver Code"),
                        providerOfficeNo: commonjs.getMessage("*", "Provider Office No"),
                        username: commonjs.getMessage("*", "Username"),
                        password: commonjs.getMessage("*", "Password"),
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
                    AuthorizationInformation: $('#txtAuthInfo').val(),
                    AuthorizationInformationQualifier: $('#txtAuthInfoQualifier').val(),
                    SecurityInformation: $('#txtSecurityInfo').val(),
                    SecurityInformationQualifier: $('#txtSecurityAuthQualifier').val(),
                    InterchangeSenderId: $('#txtSenderID').val(),
                    InterchangeSenderIdQualifier: $('#txtSenderIDQualifier').val(),
                    InterchangeReceiverId: $('#txtIReceiverID').val(),
                    InterchangeReceiverIdQualifier: $('#txtIReceiverIDQualifier').val(),
                    InterchangeControlStandardsIdentifier: $('#txtInterCtrlStandID').val(),
                    InterchangeControlVersionNumber: $('#txtInterCtrlVersionNo').val(),
                    RepetitionSeparator: $('#txtRepetitionSeperator').val(),
                    ElementDelimiter: $('#txtElementDelimiter').val(),
                    SegmentDelimiter: $('#txtSubElementDelimiter').val(),
                    SegmentTerminator: $('#txtSegmentTerminator').val(),
                    AcknowledgementRequested: $('#chkAckReq').prop('checked'),
                    UsageIndicator: $('input[name="radUsage"]:checked').val(),
                    ApplicationSenderCode: $('#txtAppSenderCode').val(),
                    ResponsibleAgencyCode: $('#txtResAgencyCode').val(),
                    ApplicationReceiverCode: $('#txtAppReceiverCode').val(),
                    VerRelIndIdCode: $('#txtVerRelIndIDCode').val(),
                    ImplementationConventionRef: $('#txtImplConventionReference').val(),
                    RequestURL: $('#txtRequestUrl').val(),
                    BackupRootFolder: $('#txtBackupRootFolder').val(),
                    IsB2bEnabled: $('#chkEnableB2B').prop('checked'),
                    XmlSyntaxTag: $('#ddlXmlTemplateSyntax').val(),
                    UserID: $('#txtUserName').val(),
                    Password: $('#txtPassword').val(),
                    ProviderOfficeNumber: $('#txtProviderOfficeNo').val()
                }
                this.model.set({
                    "name": $.trim($('#txtName').val()),
                    "code": $.trim($('#txtCode').val()),
                    "receiverName": $.trim($('#txtReceiverName').val()),
                    "receiverId": $.trim($('#txtReceiverID').val()),
                    "company_id": app.companyID,
                    "isActive": !$('#chkActive').prop('checked'),
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
             }
        });
        return EDIClearingHousesView;
    });



