define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/billing-provider-grid.html',
    'text!templates/setup/billing-provider-form.html',
    'collections/setup/billing-providers',
    'collections/setup/provider-id-codes',
    'models/setup/billing-providers',
    'models/pager',
    'shared/address'
],
    function ($,
        Immutable,
        _,
        Backbone,
        JGrid,
        JGridLocale,
        BillingProvidersGrid,
        BillingProvidersForm,
        BillingProvidersCollections,
        ProviderIdCodesCollection,
        BillingProvidersModel,
        Pager,
        Address
    ) {
        var BillingProvidersView = Backbone.View.extend({
            billingProvidersGridTemplate: _.template(BillingProvidersGrid),
            billingProvidersFormTemplate: _.template(BillingProvidersForm),
            billingProvidersList: [],
            model: null,
            billingProvidersTable: null,
            editedInsuraceIDCode : null,
            pager: null,
            events: {
                'change #chkEnableFTP': 'showFTPDetails',
                'click #btnSaveICDCode': 'saveProviderIDCodes',
                'click #btnAddNewProviderCodes': 'addNewProviderIDCodes',
                'click #btnRefreshProviderCodes': 'refreshProviderCodes',
                'click #btnCancel' : 'cancel'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingProvidersModel();
                this.billingProvidersList = new BillingProvidersCollections();
                this.providerIdCodesList = new ProviderIdCodesCollection();
                this.pager = new Pager();
                $(this.el).html(this.billingProvidersGridTemplate());
            },

            render: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("messages.status.areYouSureWantToDelete");
                $('#divBillingProvidersGrid').show();
                $('#divBillingProvidersForm').hide();
                this.billingProvidersTable = new customGrid();
                this.billingProvidersTable.render({
                    gridelementid: '#tblBillingProvidersGrid',
                    custompager: new Pager(),
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'setup.common.code', 'setup.common.name', 'setup.billingProvider.address', 'setup.billingProvider.phoneno', 'shared.fields.inactive'],
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
                            route: '#setup/billing_providers/edit/',
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-edit' i18nt='shared.buttons.edit'></i>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm(confirmDelete)) {
                                    var gridData = $('#tblBillingProvidersGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({code: gridData.code, description:gridData.name}),
                                        success: function (model, response) {
                                            commonjs.showStatus("messages.status.deletedSuccessfully");
                                            self.billingProvidersTable.refresh();
                                        },
                                        error: function (model, response) {
                                            commonjs.handleXhrError(model, response);
                                        }
                                    });
                                }
                            },
                            formatter: function (e, model, data) {
                                return "<i class='icon-ic-delete' i18nt='messages.status.clickHereToDelete'></i>"
                            }
                        },
                        {
                            name: 'code',
                           //  width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'name',
                          //   width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'address',
                            width: 400,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject) {
                                    return rowObject.address + ', ' + rowObject.address_line2;
                                }
                            },
                            searchFlag: '%'
                        },
                        {
                            name: 'phoneNumber',
                            width: 200,
                            searchFlag: '%'
                        },
                        {
                            name: 'inactivated_dt',
                            hidden: true
                        }
                    ],
                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.inactivated_dt) {
                            var $row = $('#tblBillingProvidersGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    datastore: self.billingProvidersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 1,
                    sortname: "id",
                    sortorder: "desc",
                    sortable: {
                        exclude: '#jqgh_tblBillingProvidersGrid,#jqgh_tblBillingProvidersGrid_edit,#jqgh_tblBillingProvidersGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_BillingProviders'
                });
                commonjs.initializeScreen({header: {screen: 'BillingProviders', ext: 'billingProviders'}, grid: {id: '#tblBillingProvidersGrid'}, buttons: [
                    {value: 'Add', class: 'btn btn-danger', i18n: 'shared.buttons.add', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_providers/new', true);
                    }},
                    {value: 'Reload', class: 'btn', i18n: 'shared.buttons.reload', clickEvent: function () {
                        self.pager.set({"PageNo": 1});
                        self.billingProvidersTable.refreshAll();
                        commonjs.showStatus("messages.status.reloadedSuccessfully");
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
                var self = this;
                var qualifierCodes = app.provider_id_code_qualifiers;
                var states = app.states[0].app_states;
                $('#divBillingProvidersForm').html(this.billingProvidersFormTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    billingRegionCode: app.billingRegionCode,
                    qualifierCodes: qualifierCodes,
                    states: states
                }));
                if ( app.country_alpha_3_code === 'can' && app.province_alpha_2_code === 'ON' ) {
                    $('#txtNpi').attr('maxlength', 4);
                }
                if ( app.billingRegionCode === 'can_BC' ) {
                    $('#txtFederalTaxID').attr({'readonly':true, "placeholder":"1234"});
                }
                var AddressInfoMap = {
                    city: {
                        domId: 'txtCity',
                        infoKey: 'city'
                    },
                    state: {
                        domId: 'ddlState',
                        infoKey: 'state'
                    },
                    zipCode: {
                        domId: 'txtZip',
                        infoKey: 'zip'
                    },
                    zipCodePlus: {
                        domId: 'txtZipPlus',
                        infoKey: 'zipPlus'
                    }
                }
                var payToAddressMap = {
                    city: {
                        domId: 'txtPayCity',
                        infoKey: 'city'
                    },
                    state: {
                        domId: 'ddlPayState',
                        infoKey: 'state'
                    },
                    zipCode: {
                        domId: 'txtPayZip',
                        infoKey: 'zip'
                    },
                    zipCodePlus: {
                        domId: 'txtPayZipPlus',
                        infoKey: 'zipCodePlus'
                    }
                }
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                var communication_info = data.communication_info;
                                if (data) {
                                    Address.loadCityStateZipTemplate('#divAddressInfo', data, AddressInfoMap);
                                    Address.loadCityStateZipTemplate('#divPayToAddress', data, payToAddressMap);
                                    $('#txtName').val(data.name || '');
                                    $('#chkIsActive').prop('checked', !!data.inactivated_dt);
                                    $('#chkAltPay').prop('checked', data.can_bc_is_alt_payment_program);
                                    $('#txtCode').val(data.code || '');
                                    $('#txtShortDesc').val(data.short_description || '');
                                    $('#txtFederalTaxID').val(data.federal_tax_id || '');
                                    $('#txtNpi').val(data.npi_no || '');
                                    $('#txtTaxonomy').val(data.taxonomy_code || '');
                                    $('#txtContactName').val(data.contact_person_name || '');
                                    $('#txtAddressLine1').val(data.address_line1 || '');
                                    $('#txtAddressLine2').val(data.address_line2 || '');
                                    $('#txtCity').val(data.city || '');
                                    $('#ddlState').val(data.state || '');
                                    $('#txtZip').val(data.zip_code || '');
                                    $('#txtZipPlus').val(data.zip_code_plus || '');
                                    $('#txtEmail').val(data.email || '');
                                    $('#txtBillProPhoneNo').val(data.phone_number || '');
                                    $('#txtFaxNo').val(data.fax_number || '');
                                    $('#txtWebURL').val(data.web_url || '');
                                    $('#txtPayAddressLine1').val(data.pay_to_address_line1 || '');
                                    $('#txtPayAddressLine2').val(data.pay_to_address_line2 || '');
                                    $('#txtPayCity').val(data.pay_to_city || '');
                                    $('#ddlPayState').val(data.pay_to_state || '');
                                    $('#txtPayZip').val(data.pay_to_zip_code || '');
                                    $('#txtPayZipPlus').val(data.pay_to_zip_code_plus || '');
                                    $('#txtPayEmail').val(data.pay_to_email || '');
                                    $('#txtPayBillProPhoneNo').val(data.pay_to_phone_number || '');
                                    $('#txtPayFaxNo').val(data.pay_to_fax_number || '');
                                    $('#txtPayeeNumber').val(data.can_bc_payee_number || '');
                                    $('#txtDataCentreNumber').val(data.can_bc_data_centre_number || '');

                                    $('#chkEnableFTP').prop('checked', !!communication_info.enable_ftp);
                                    $('#txtHostName').val(communication_info.Ftp_host || '');
                                    $('#txtPort').val(communication_info.Ftp_port || '');
                                    $('#txtUserName').val(communication_info.Ftp_user_name || '');
                                    $('#txtPassword').val(communication_info.Ftp_password || '');
                                    $('#ddlFtpType').val(communication_info.Ftp_type || '');
                                    $('#txtSentFolder').val(communication_info.Ftp_sent_folder || '');
                                    $('#txtReceiveFolder').val(communication_info.Ftp_receive_folder || '');
                                    $('#txtIdentityFilePath').val(communication_info.Ftp_identity_file || '');

                                    var $txtPayCity = $("[for=txtPayCity]");
                                    $txtPayCity.find("span").remove();
                                    $txtPayCity.removeClass('field-required');

                                }
                                self.showFTPDetails();
                                self.bindProviderIDCodes();
                            }
                        }
                    });
                } else {
                    this.model = new BillingProvidersModel();

                }
                commonjs.initializeScreen({header: {screen: 'BillingProviders', ext: 'billingProvider'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveBillingProviders();
                    }},
                    {value: 'Back', class: 'btn', i18n: 'shared.buttons.back', clickEvent: function () {
                        Backbone.history.navigate('#setup/billing_providers/list', true);
                    }}
                ]});
                Address.loadCityStateZipTemplate('#divAddressInfo', {}, AddressInfoMap);
                Address.loadCityStateZipTemplate('#divPayToAddress', {}, payToAddressMap);
                $('#divBillingProvidersGrid').hide();
                $('#divBillingProvidersForm').show();
                $('#divFTPDetails').hide();
                $('#divIDCodesGrid').hide();
                $('#divIDCodesForm').hide();
                this.bindInsuranceAutocomplete('ddlInsuranceProvider');
                commonjs.processPostRender();
            },

            trimFieldsForSave: function () {
                $('#formBillingProviders input[type=text]').each(function (index, el) {
                    var $el = $(el);
                    if ($el.hasClass('text-uppercase')) {
                        $el.val($.trim($el.val().toUpperCase()) || null);
                    } else {
                        $el.val($.trim($el.val()) || null);
                    }
                });

                $('#formBillingProviders select').each(function (index, el) {
                    var $el = $(el);
                    var val = $.trim($el.val());
                    $el.val(val && val !== 'Select' ? val : null);
                });
            },

            addNewBillingProviders: function () {
                location.href = "#setup/billing_providers/new";
            },

            backToBillingProvidersGrid: function () {
                location.href = "#setup/billing_providers/list";
            },

            refreshBillingProvidersGrid: function () {
                this.BillingProvidersTable.refresh();
                commonjs.showStatus("messages.status.reloadedSuccessfully");
            },

            saveBillingProviders : function() {
                this.trimFieldsForSave();

                var rules = {
                    providerName: {
                        required: true
                    },
                    providerCode: {
                        required: true
                    },
                    shortDescription: {
                        required: true
                    },
                    federalTaxID: {
                        required: app.country_alpha_3_code === 'usa'
                    },
                    npiNo: {
                        required: (app.country_alpha_3_code !== 'can' || app.province_alpha_2_code !== 'AB')
                    },
                    taxonomy: {
                        required: app.country_alpha_3_code === 'usa'
                    },
                    contactPersonName: {
                        required: true
                    },
                    addressLine1: {
                        required: true
                    },
                    city: {
                        required: true
                    },
                    state: {
                        required: true
                    },
                    zip: {
                        required: true
                    },
                    phoneNo: {
                        required: true
                    },
                    faxNo: {
                        required: true
                    },
                    email: {
                        email: true
                    }
                }

                var payeeNumber = $('#txtPayeeNumber');
                var payeeNumberRegex = !(/^[a-z0-9]+$/i.test(payeeNumber.val()));

                if (app.billingRegionCode === "can_BC" && payeeNumber.val() && payeeNumberRegex) {
                    commonjs.showWarning('messages.warning.setup.payeeNumber', 'mediumwarning');
                    return false;
                }

                var messages = {
                    providerName: commonjs.getMessage("e", "Billing Provider Name"),
                    providerCode: commonjs.getMessage("e", "Billing Provider Code"),
                    shortDescription: commonjs.getMessage("e", "Billing Provider Short Desc"),
                    federalTaxID: commonjs.getMessage("e", "Federal Tax ID"),
                    npiNo: commonjs.getMessage("e", "Npi No"),
                    taxonomy: commonjs.getMessage("e", "Taxonomy Code"),
                    contactPersonName: commonjs.getMessage("e", "Contact Person Name"),
                    addressLine1: commonjs.getMessage("e", "AddressLine1"),
                    city: commonjs.getMessage("e", "City"),
                    state: commonjs.getMessage("e", "State"),
                    zip: commonjs.getMessage("e", "Zip"),
                    phoneNo: commonjs.getMessage("e", "Phone Number"),
                    faxNo: commonjs.getMessage("e", "Fax Number"),
                    email: commonjs.getMessage("e", "Email")
                }

                if ($('#chkEnableFTP').prop('checked')) {
                    rules.hostname = { required: true }
                    rules.username = { required: true }
                    rules.password = { required: true }
                    rules.port = { required: true }
                    rules.sentFolder = { required: true }
                    rules.receiveFolder = { required: true }
                    messages.hostname = commonjs.getMessage("e", "FTP Host Name");
                    messages.username = commonjs.getMessage("e", "FTP User Name");
                    messages.password = commonjs.getMessage("e", "FTP Passord");
                    messages.port = commonjs.getMessage("e", "FTP Port");
                    messages.sentFolder = commonjs.getMessage("e", "FTP Sent Folder");
                    messages.ReceiveFolder = commonjs.getMessage("e", "FTP Receive Folder");
                }

                commonjs.validateForm({
                    rules: rules,
                    messages : messages,
                    submitHandler: function () {
                        this.save();
                    }.bind(this),
                    formID: '#formBillingProviders',
                    onkeyup: function(element) { $(element).valid(); },
                });

                $('#formBillingProviders').submit();
            },

            save: function () {
                if (!$('#txtCity').val()) {
                    return commonjs.showWarning("messages.warning.pleaseEnterCity");
                }
                if (!$('#ddlState').val()) {
                    return commonjs.showWarning("messages.warning.pleaseSelectState");
                }
                if (!$('#txtZip').val()) {
                    return commonjs.showWarning("messages.warning.pleaseEnterZip");
                }
                if (!commonjs.validateZipInputCanada('txtZip')) {
                    commonjs.showWarning('messages.warning.shared.invalidPostal');
                    return false;
                }

                var isFtpEnabled = $('#chkEnableFTP').prop('checked');
                var communication_info = {
                    "enable_ftp": isFtpEnabled,
                    "Ftp_host": isFtpEnabled ? $('#txtHostName').val() : "",
                    "Ftp_port": isFtpEnabled ? $('#txtPort').val() : "",
                    "Ftp_user_name": isFtpEnabled ? $('#txtUserName').val() : "",
                    "Ftp_password": isFtpEnabled ? $('#txtPassword').val() : "",
                    "Ftp_type": isFtpEnabled ? $('#ddlFtpType').val() : "",
                    "Ftp_sent_folder": isFtpEnabled ? $('#txtSentFolder').val() : "",
                    "Ftp_receive_folder": isFtpEnabled ? $('#txtReceiveFolder').val() : "",
                    "Ftp_identity_file": isFtpEnabled ? $('#txtIdentityFilePath').val() : ""
                }

                this.model.set({
                    "name": $('#txtName').val(),
                    "isActive": !$('#chkIsActive').prop('checked'),
                    "companyId": app.companyID,
                    "code": $('#txtCode').val(),
                    "shortDescription": $('#txtShortDesc').val(),
                    "federalTaxId": $('#txtFederalTaxID').val(),
                    "npiNo": $('#txtNpi').val(),
                    "taxonomyCode": (app.country_alpha_3_code === "can") ? "1234567890" : $('#txtTaxonomy').val().toUpperCase(),
                    "contactPersonName": $('#txtContactName').val(),
                    "addressLine1": $('#txtAddressLine1').val(),
                    "addressLine2": $('#txtAddressLine2').val(),
                    "city": $('#txtCity').val(),
                    "state": $('#ddlState').val(),
                    "zipCode": $('#txtZip').val(),
                    "zipCodePlus": $('#txtZipPlus').val(),
                    "email": $('#txtEmail').val(),
                    "phoneNumber": $('#txtBillProPhoneNo').val(),
                    "faxNumber": $('#txtFaxNo').val(),
                    "webUrl": $('#txtWebURL').val(),
                    "payToAddressLine1": $('#txtPayAddressLine1').val(),
                    "payToAddressLine2": $('#txtPayAddressLine2').val(),
                    "payToCity": $('#txtPayCity').val(),
                    "payToState": $('#ddlPayState').val(),
                    "payToZipCode": $('#txtPayZip').val(),
                    "payToZipCodePlus": $('#txtPayZipPlus').val(),
                    "payToEmail": $('#txtPayEmail').val(),
                    "payToPhoneNumber": $('#txtPayBillProPhoneNo').val(),
                    "payToFaxNumber": $('#txtPayFaxNo').val(),
                    "communicationInfo": communication_info,
                    "canIsAlternatePaymentProgram" : $('#chkAltPay').prop('checked'), 
                    "payeeNumber": $('#txtPayeeNumber').val(),
                    "dataCentreNumber": $('#txtDataCentreNumber').val()
                });

                this.model.save({}, {
                    success: function (model, response) {
                        commonjs.showStatus('messages.status.savedSuccessfully');
                        if (response) {
                            location.href = "#setup/billing_providers/list";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            bindInsuranceAutocomplete: function (element_id) {
                var self = this;
                $("#" + element_id).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurances",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: app.companyID,
                                isInactive: false
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select carrier',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var insurance_info = commonjs.hstoreParse(repo.insurance_info);
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.insurance_code + "(" + repo.insurance_name + ")'> <div>" + repo.insurance_code + "(" + repo.insurance_name + ")" + "</div><div>" + insurance_info.Address1 + "</div>";
                    markup += "<div>" + insurance_info.City + ", " + insurance_info.State + " " + insurance_info.ZipCode + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.insurance_name;
                    }
                }
            },

            bindProviderIDCodes: function () {
                var self = this;
                var confirmDelete = commonjs.geti18NString("message.status.areYouSureWantToDelete");
                var width = $('#divBillingProvidersForm').width() - 50;
                $('#divIDCodesGrid').show();
                self.providerIdCodesTable = new customGrid();
                self.providerIdCodesTable.render({
                    gridelementid: '#tblProviderIDCodesGrid',
                    custompager: new Pager(),   // make sure you provide this or it won't work because customgrid *needs* to override whatever is specified in here anyway
                    customargs: {
                        provider_id: self.model.id
                    },
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', '', 'Insurance Name', 'Payer Assigned Provider ID', 'Legacy ID Qualifier', 'in_active'],
                    i18nNames:['', '', '', '', '',  'setup.insuranceX12Mapping.insuranceName', 'setup.billingprovider.payerassignedproviderid' ,'setup.billingprovider.legacyidqualifier','shared.fields.inactive'],
                    colModel: [
                        { name: 'id', key: true, hidden: true },
                        { name: 'insurance_provider_id', hidden: true },
                        { name: 'qualifier_id', hidden: true },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            formatter: function () {
                                return "<span class='icon-ic-edit' title='Edit this id code'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            formatter: function () {
                                return "<span class='icon-ic-delete' title='Delete this id code'></span>"
                            }
                        },
                        { name: 'insurance_name', width: 300 },
                        { name: 'payer_assigned_provider_id', width: 200 },
                        { name: 'qualifier_desc', width: 300 },
                        {
                            name: 'isActive',
                            hidden: true
                        }
                    ],

                    afterInsertRow: function (rowid, rowdata) {
                        if (rowdata.isActive) {
                            var $row = $('#tblProviderIDCodesGrid').find('#' + rowid);
                            $row.css('text-decoration', 'line-through');
                        }
                    },
                    ondblClickRow: function (rowID) {
                        self.editingProviderIDCodes(rowID);
                    },
                    beforeSelectRow: function (rowID, e) {
                        switch ((e.target || e.srcElement).className) {
                            case "icon-ic-delete":
                                if(confirm(confirmDelete)) {
                                    self.removeProviderIDCode(rowID);
                                }
                                break;
                            case "icon-ic-edit":
                                self.editingProviderIDCodes(rowID);
                        }
                    },
                    datastore: self.providerIdCodesList,
                    container: self.el,

                    sortable: {
                        exclude: '#jqgh_tblBillingProvidersGrid,#jqgh_tblBillingProvidersGrid_edit,#jqgh_tblBillingProvidersGrid_del'
                    },

                    disablepaging: false,
                    disableadd: true,
                    disablereload: true,
                    pager: '#gridPager_BillingProviderIdCodes'
                });

                $('#tblProviderIDCodesGrid').jqGrid('setGridHeight', 200);
                $('#divCodesGrid').css({'width':width});
                $('#tblProviderIDCodesGrid').jqGrid('clearGridData');

            },

            editingProviderIDCodes: function (rowID) {
                var self = this;
                self.clearIDCodesForm();
                self.editProviderIDCodeData = $('#tblProviderIDCodesGrid').jqGrid('getRowData', rowID);
                $('#divIDCodesForm').show();
                var rowData = self.editProviderIDCodeData;
                if (rowData.payer_assigned_provider_id) {
                    $('#txtPayerAssProId').val(rowData.payer_assigned_provider_id);
                }
                if (rowData.qualifier_id) {
                    $('#ddlIdCodeQualifier').val(rowData.qualifier_id);
                }
                if (rowData.insurance_name) {
                    $('#select2-ddlInsuranceProvider-container').html(rowData.insurance_name);
                }
                $('#txtPayerAssProId').focus();
            },

            removeProviderIDCode : function (rowID) {
                var self = this;
                var rowData = $('#tblProviderIDCodesGrid').jqGrid('getRowData', rowID);
                $.ajax({
                    url: '/exa_modules/billing/setup/provider_id_codes',
                    type: "DELETE",
                    data: {
                        id : rowData.id,
                        provider_id : self.model.id
                    },
                    success: function (model, response) {
                        $('#tblProviderIDCodesGrid').jqGrid('delRowData', rowID);
                        self.clearIDCodesForm();
                        self.bindProviderIDCodes();
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            showFTPDetails: function () {
                if ($('#chkEnableFTP').prop('checked')) {
                    $('#divFTPDetails').show();
                } else {
                    $('#divFTPDetails').hide();
                }
            },

            clearIDCodesForm: function () {
                $('#txtPayerAssProId').val('');
                $('#ddlIdCodeQualifier').val('');
                $('#select2-ddlInsuranceProvider-container').html('');
                $('#divIDCodesForm').hide();
                self.editProviderIDCodeData = null;
            },

            saveProviderIDCodes: function () {
                var self = this;
                var rowData = self.editProviderIDCodeData;
                var type = 'POST';
                var data = {
                    providerId: this.model.id,
                    insuranceProviderId: $('#ddlInsuranceProvider').val(),
                    qualifierId: $('#ddlIdCodeQualifier').val(),
                    payerAssignedProviderId: $('#txtPayerAssProId').val()
                };
                if(rowData) {
                    data.id = rowData.id;
                    data.insuranceProviderId = rowData.insurance_provider_id;
                    type = 'PUT';
                }
                if (!data.payerAssignedProviderId) {
                    return commonjs.showStatus("Please Enter Payer Assigned Provider ID");
                }
                if(!data.qualifierId) {
                    return commonjs.showStatus("Please Select ID Code Qualifier");
                }
                if(!data.insuranceProviderId) {
                    return commonjs.showStatus("Please Select Insurance Provider");
                }
                if(this.checkExist()) {
                    return commonjs.showStatus("Insurance Provider Already Exists");
                }
                $.ajax({
                    url: '/exa_modules/billing/setup/provider_id_codes',
                    type: type,
                    data: data,
                    success: function (model, response) {
                        commonjs.showStatus('messages.status.savedSuccessfully');
                        self.clearIDCodesForm();
                        self.bindProviderIDCodes();
                    },
                    error: function (model, response) {

                    }
                });
            },

            addNewProviderIDCodes: function () {
                $('#divIDCodesForm').show();
                $('#txtPayerAssProId').focus();
            },

            refreshProviderCodes: function() {
                this.bindProviderIDCodes();
                commonjs.showWarning("messages.status.reloadedSuccessfully");
            },

            cancel: function () {
                this.clearIDCodesForm();
                $('#divIDCodesForm').hide();
            },

            checkExist: function () {
                var self = this, id = [], idarray = [];
                var provider_id = (self.editProviderIDCodeData && self.editProviderIDCodeData.id) || '';
                $.each($("#tblProviderIDCodesGrid tr"), function () {
                    if ($(this).hasClass('ui-widget-content'))
                        if (this.id != provider_id)
                            id.push(this.id);
                })
                $.each(id, function (index, val) {
                    var cellVal = $("#tblProviderIDCodesGrid").jqGrid('getCell', val, 'insurance_provider_id');
                    idarray.push(cellVal);
                });

                if (self.editProviderIDCodeData) {
                    if ($.inArray(self.editProviderIDCodeData.insurance_provider_id, idarray) == -1)
                        return false;
                    else
                        return true;

                }
                else if ($.inArray($('#ddlInsuranceProvider').val(), idarray) == -1) {
                    return false;
                }
                else
                    return true;
            }
        });
        return BillingProvidersView;
    });
