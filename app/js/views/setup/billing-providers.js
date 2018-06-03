define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/setup/billing-provider-grid.html',
    'text!templates/setup/billing-provider-form.html',
    'collections/setup/billing-providers',
    'models/setup/billing-providers',
    'models/pager'
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
        BillingProvidersModel,
        Pager
    ) {
        var BillingProvidersView = Backbone.View.extend({
            billingProvidersGridTemplate: _.template(BillingProvidersGrid),
            billingProvidersFormTemplate: _.template(BillingProvidersForm),
            billingProvidersList: [],
            model: null,
            billingProvidersTable: null,
            events: {
                'click #btnAddBillingProviders': 'addNewBillingProviders',
                'click #btnSaveBillingProviders': 'saveBillingProviders',
                'click #btnBackToBillingProvidersGrid': 'backToBillingProvidersGrid',
                'click #btnRefresh': 'refreshBillingProvidersGrid',
                'change #chkEnableFTP': 'showFTPDetails',
                'click #btnSaveICDCode': 'saveProviderIDCodes',
                'click #btnAddNewProviderCodes': 'addNewProviderIDCodes'

            },
            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new BillingProvidersModel();
                this.billingProvidersList = new BillingProvidersCollections();
            },

            render: function () {
                var self = this;
                $('#divBillingProvidersGrid').show();
                $('#divBillingProvidersForm').hide();
                $(this.el).html(this.billingProvidersGridTemplate());
                this.BillingProvidersTable = new customGrid();
                this.BillingProvidersTable.render({
                    gridelementid: '#tblBillingProvidersGrid',
                    custompager: new Pager(),
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', '', '', '', ''],
                    i18nNames: ['', '', '', 'shared.common.code', 'shared.common.name', 'setup.billingprovider.address', 'setup.billingprovider.phoneno'],
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
                                return "<span class='icon-ic-edit' title='click Here to Edit'></span>"
                            }
                        },
                        {
                            name: 'del', width: 20, sortable: false, search: false,
                            className: 'icon-ic-delete',
                            customAction: function (rowID) {
                                if (confirm("Are you sure want to delete")) {
                                    var gridData = $('#tblBillingProvidersGrid').jqGrid('getRowData', rowID);
                                    self.model.set({ "id": rowID });
                                    self.model.destroy({
                                        data: $.param({ id: self.model.id }),
                                        success: function (model, response) {
                                            commonjs.showStatus("Deleted Successfully");
                                            self.billingProvidersTable.refresh();
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
                            name: 'code',
                            width: 180,
                            searchFlag: '%'
                        },
                        {
                            name: 'name',
                            width: 400,
                            searchFlag: '%'
                        },
                        {
                            name: 'address_line1',
                            width: 400,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject) {
                                    return `${rowObject.address_line1}${rowObject.address_line2}`;
                                }
                            },
                            searchFlag: '%'
                        },
                        {
                            name: 'phone_number',
                            width: 200,
                            searchFlag: '%'
                        },
                    ],
                    datastore: self.billingProvidersList,
                    container: self.el,
                    customizeSort: true,
                    offsetHeight: 01,
                    sortable: {
                        exclude: '#jqgh_tblBillingProvidersGrid,#jqgh_tblBillingProvidersGrid_edit,#jqgh_tblBillingProvidersGrid_del'
                    },
                    dblClickActionIndex: 1,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true
                });
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
                // var ipForm = $(this.el).find('#divBillingProvidersForm');
                // ipForm.html(this.billingProviderTemplateForm);
                // commonjs.validateForm({
                //     rules: {
                //         code: {
                //             minlength: 2,
                //             maxlength: 16,
                //             required: true
                //         },
                //         description: {
                //             required: true,
                //             minlength: 2
                //         }
                //     },
                //     messages: {
                //         code: commonjs.getMessage("*", "Icd Code(16 Characters only)"),
                //         description: commonjs.getMessage("*", "Icd Description")
                //     },
                //     submitHandler: function () {
                //         self.save();
                //     },
                // });
                //     formID: '#inputFormICD'

                $('#divBillingProvidersForm').html(this.billingProvidersFormTemplate());
                if (id > 0) {
                    this.model.set({ id: id });
                    this.model.fetch({
                        data: { id: this.model.id },
                        success: function (model, response) {
                            if (response && response.length > 0) {
                                var data = response[0];
                                var communication_info = data.communication_info;
                                if (data) {
                                    $('#txtName').val(data.name ? data.name : '');
                                    $('#txtCode').val(data.code ? data.code : '');
                                    $('#txtShortDesc').val(data.short_description ? data.short_description : '');
                                    $('#txtFederalTaxID').val(data.federal_tax_id ? data.federal_tax_id : '');
                                    $('#txtNpi').val(data.npi_no ? data.npi_no : '');
                                    $('#txtTaxonomy').val(data.taxonomy_code ? data.taxonomy_code : '');
                                    $('#txtContactName').val(data.contact_person_name ? data.contact_person_name : '');
                                    $('#txtAddressLine1').val(data.address_line1 ? data.address_line1 : '');
                                    $('#txtAddressLine2').val(data.address_line2 ? data.address_line2 : '');
                                    $('#txtCity').val(data.city ? data.city : '');
                                    $('#ddlState').val(data.state ? data.state : '');
                                    $('#txtZip').val(data.zip_code ? data.zip_code : '');
                                    $('#txtZipPlus').val(data.zip_code_plus ? data.zip_code_plus : '');
                                    $('#txtEmail').val(data.email ? data.email : '');
                                    $('#txtBillProPhoneNo').val(data.phone_number ? data.phone_number : '');
                                    $('#txtFaxNo').val(data.fax_number ? data.fax_number : '');
                                    $('#txtWebURL').val(data.web_url ? data.web_url : '');
                                    $('#txtPayAddressLine1').val(data.pay_to_address_line1 ? data.pay_to_address_line1 : '');
                                    $('#txtPayAddressLine2').val(data.pay_to_address_line2 ? data.pay_to_address_line2 : '');
                                    $('#txtPayCity').val(data.pay_to_city ? data.pay_to_city : '');
                                    $('#ddlPayState').val(data.pay_to_state ? data.pay_to_state : '');
                                    $('#txtPayZip').val(data.pay_to_zip_code ? data.pay_to_zip_code : '');
                                    $('#txtPayZipPlus').val(data.pay_to_zip_code_plus ? data.pay_to_zip_code_plus : '');
                                    $('#txtPayEmail').val(data.pay_to_email ? data.pay_to_email : '');
                                    $('#txtPayBillProPhoneNo').val(data.pay_to_phone_number ? data.pay_to_phone_number : '');
                                    $('#txtPayFaxNo').val(data.pay_to_fax_number ? data.pay_to_fax_number : '');
                                    $('#chkEnableFTP').prop('checked', communication_info.enable_ftp ? communication_info.enable_ftp : false);
                                    $('#txtHostName').val(communication_info.Ftp_host ? communication_info.Ftp_host : '');
                                    $('#txtPort').val(communication_info.Ftp_port ? communication_info.Ftp_port : '');
                                    $('#txtUserName').val(communication_info.Ftp_user_name ? communication_info.Ftp_user_name : '');
                                    $('#txtPassword').val(communication_info.Ftp_password ? communication_info.Ftp_password : '');
                                    $('#ddlFtpType').val(communication_info.Ftp_type ? communication_info.Ftp_type : '');
                                    $('#txtSentFolder').val(communication_info.Ftp_sent_folder ? communication_info.Ftp_sent_folder : '');
                                    $('#txtReceiveFolder').val(communication_info.Ftp_receive_folder ? communication_info.Ftp_receive_folder : '');
                                    $('#txtIdentityFilePath').val(communication_info.Ftp_identity_file ? communication_info.Ftp_identity_file : '');
                                }
                                self.showFTPDetails();
                                self.showProviderIDCodes();
                            }
                        }
                    });
                } else {
                    this.model = new BillingProvidersModel();

                }
                $('#divBillingProvidersGrid').hide();
                $('#divBillingProvidersForm').show();
                $('#divFTPDetails').hide();
                $('#divIDCodesGrid').hide();
                $('#divIDCodesForm').hide();
                this.bindInsuranceAutocomplete('ddlInsuranceProvider');
                commonjs.processPostRender();
            },

            addNewBillingProviders: function () {
                location.href = "#setup/billing_providers/new";
            },

            backToBillingProvidersGrid: function () {
                location.href = "#setup/billing_providers/list";
            },

            refreshBillingProvidersGrid: function () {
                this.billingProvidersTable.refresh();
            },

            saveBillingProviders: function () {
                let communication_info = {
                    "enable_ftp": $('#chkEnableFTP').prop('checked'),
                    "Ftp_host": $.trim($('#txtHostName').val()),
                    "Ftp_port": $.trim($('#txtPort').val()),
                    "Ftp_user_name": $.trim($('#txtUserName').val()),
                    "Ftp_password": $.trim($('#txtPassword').val()),
                    "Ftp_type": $.trim($('#ddlFtpType').val()),
                    "Ftp_sent_folder": $.trim($('#txtSentFolder').val()),
                    "Ftp_receive_folder": $.trim($('#txtReceiveFolder').val()),
                    "Ftp_identity_file": $.trim($('#txtIdentityFilePath').val())
                }
                this.model.set({
                    "name": $.trim($('#txtName').val()),
                    "isActive": "",
                    "companyId": app.companyID,
                    "code": $.trim($('#txtCode').val()),
                    "shortDescription": $.trim($('#txtShortDesc').val()),
                    "federalTaxId": $.trim($('#txtFederalTaxID').val()),
                    "npiNo": $.trim($('#txtNpi').val()),
                    "taxonomyCode": $.trim($('#txtTaxonomy').val()),
                    "contactPersonName": $.trim($('#txtContactName').val()),
                    "addressLine1": $.trim($('#txtAddressLine1').val()),
                    "addressLine2": $.trim($('#txtAddressLine2').val()),
                    "city": $.trim($('#txtCity').val()),
                    "state": $('#ddlState').val(),
                    "zipCode": $.trim($('#txtZip').val()),
                    "zipCodePlus": $.trim($('#txtZipPlus').val()),
                    "email": $.trim($('#txtEmail').val()),
                    "phoneNumber": $.trim($('#txtBillProPhoneNo').val()),
                    "faxNumber": $.trim($('#txtFaxNo').val()),
                    "webUrl": $.trim($('#txtWebURL').val()),
                    "payToAddressLine1": $.trim($('#txtPayAddressLine1').val()),
                    "payToAddressLine2": $.trim($('#txtPayAddressLine2').val()),
                    "payToCity": $.trim($('#txtPayCity').val()),
                    "payToState": $('#ddlPayState').val(),
                    "payToZipCode": $.trim($('#txtPayZip').val()),
                    "payToZipCodePlus": $.trim($('#txtPayZipPlus').val()),
                    "payToEmail": $.trim($('#txtPayEmail').val()),
                    "payToPhoneNumber": $.trim($('#txtPayBillProPhoneNo').val()),
                    "payToFaxNumber": $.trim($('#txtPayFaxNo').val()),
                    "communicationInfo": communication_info
                });
                this.model.save({
                }, {
                        success: function (model, response) {
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
                                page: params.page || 20,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
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

            showProviderIDCodes: function () {
                $('#divIDCodesGrid').show();
                // TODO: Bind provider id code grid
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
            },

            saveProviderIDCodes: function () {
                var self = this;
                var data = {
                    providerId: this.model.id,
                    insuranceProviderId: $('#ddlInsuranceProvider').val(),
                    qualifierId: 1, // TODO: needs to give a qualifier id
                    payerAssignedProviderId: $('#txtPayerAssProId').val()
                };
                $.ajax({
                    url: '/exa_modules/billing/setup/provider_id_codes',
                    type: 'POST',
                    data: data,
                    success: function (model, response) {
                        self.clearIDCodesForm();
                        // TODO: Bind provider id code grid 
                    },
                    error: function (model, response) {

                    }
                });
            },

            addNewProviderIDCodes: function () {
                $('#divIDCodesForm').show();
            },

            cancel: function () {
                this.clearIDCodesForm();
                $('#divIDCodesForm').hide();
            }
        });
        return BillingProvidersView;
    });