define([
    'jquery',
    'underscore',
    'backbone',
    'jquerysortable',
    'text!templates/user-settings.html',
    'models/user-settings',
    'shared/fields'
], function (
    $,
    _,
    Backbone,
    jquerysortable,
    userSettingsTemplate,
    ModelUserSetting,
    defaultFields ) {
        return Backbone.View.extend({
            template: _.template(userSettingsTemplate),
            events: {
                "click #close_settings": "closePopup"
            },

            initialize: function () {
                self.template = _.template(userSettingsTemplate);
                this.model = new ModelUserSetting();
            },
            gridFilterName: null,

            render: function () {
                var self = this;
                var userID = app.userID;
                this.$el.html(self.template({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    billing_region_code: app.billingRegionCode
                }));
                if (window.location && window.location.hash.split('/')[1] == 'studies') {
                    self.gridFilterName = 'studies';
                    self.default_tab = app.default_study_tab;
                    $('#divPrinterTemplates').hide();
                }
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench') {
                    self.gridFilterName = 'claims';
                    self.default_tab = app.default_claim_tab;
                    $('#divPrinterTemplates').show();
                }
                var height = $('#modal_div_container').height() - 70;
                $("#ulSortList").css('height', height);
                this.bindSettingColumns(userID);
                $(".simple_with_animation").sortable();
                $('#save_settings').unbind().click(function () {
                    $('#save_settings').attr('disabled', true);
                    self.saveUserSettingsBilling(userID);
                    commonjs.hideDialog();
                });
            },

            saveUserSettingsBilling: function (userId) {
                var self = this;
                var claim_col_name = '';
                var claim_sort_order = '';
                var claimFieldOrder = [];
                var claimSettingFields = [];
                var billingClaimGridFields = [];

                if (self.gridFilterName == 'studies') {
                    billingClaimGridFields = app.study_user_settings.grid_field_settings || [];
                } else if (self.gridFilterName == 'claims') {
                    billingClaimGridFields = app.claim_user_settings.grid_field_settings || [];
                }

                claim_col_name = $('#ddlBillingDefaultColumns').val();
                claim_sort_order = $('#ddlBillingSortOrder').val();
                $('#ulSortList li').each(function () {
                    var input = $($(this).find('input[type=checkbox]')[0]);
                    claimFieldOrder.push(input.attr('id').split('~')[1]);
                    if (input.is(':checked')) {
                        claimSettingFields.push(input.attr('id').split('~')[1]);
                        if (_.findIndex(billingClaimGridFields, { name: input.val() }) == -1) {
                            billingClaimGridFields.push({
                                "name": input.val(),
                                "id": input.attr('id').split('~')[1],
                                "width": $(this).find('input[type=hidden]')[0].value || 0
                            });
                        }
                    }
                });

                this.model.set({
                    flag: self.gridFilterName,
                    default_tab: self.default_tab,
                    userId: userId,
                    claim_col_name: claim_col_name,
                    claim_sort_order: claim_sort_order,
                    billingClaimGridFields: JSON.stringify(billingClaimGridFields),
                    claimFieldOrder: JSON.stringify(claimFieldOrder),
                    claimSettingFields: claimSettingFields,
                    paper_claim_full: $('#ddlPaperClaimFullForm').val() || null,
                    paper_claim_original: $('#ddlPaperClaimOriginalForm').val() || null,
                    direct_invoice: $('#ddlDirectInvoice').val() || null,
                    patient_invoice: $('#ddlPatientInvoice').val() || null,
                    special_form: $('#ddlSpecialForm').val() || null

                });
                this.model.save({},
                    {
                        success: function () {

                            $('#save_settings').prop('disabled', false);
                            if (self.gridFilterName == 'studies'){
                                app.study_user_settings.field_order = claimSettingFields.map(Number);
                                app.study_user_settings.default_column_order_by =claim_sort_order;
                                app.study_user_settings.default_column =claim_col_name;
                                app.study_user_settings.default_tab =self.default_tab;
                                app.study_user_settings.grid_field_settings = billingClaimGridFields;
                                $('#btnStudiesCompleteRefresh').click();
                            }
                            else if (self.gridFilterName == 'claims'){
                                app.claim_user_settings.field_order =claimSettingFields.map(Number);
                                app.claim_user_settings.default_column_order_by =claim_sort_order;
                                app.claim_user_settings.default_column =claim_col_name;
                                app.claim_user_settings.default_tab =self.default_tab;
                                app.claim_user_settings.grid_field_settings = billingClaimGridFields;
                                $('#btnClaimsCompleteRefresh').click();
                            }

                            commonjs.hideDialog();
                            commonjs.hideLoading();
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            ulListBinding: function (field_order, listID, checkedGridFields) {
                var checkedFieldLength = this.checkedFields.length;
                $('#' + listID).empty();
                for (var i = 0; i < field_order.length; i++) {
                    var id = 'sf~' + field_order[i].id;
                    var value = field_order[i].field_name;
                    var i18nLabel = field_order[i].i18n_name;
                    var newLi = $('<li>');
                    var newCB = CreateCheckBox(value, id, i18nLabel);
                    var defaultOptions = ['Claim Created Dt', 'Billing Method', 'Patient Name', 'Claim Date', 'Clearing House', 'Billing Provider', 'Patient', 'Study Date', 'Account#', 'Status', 'Accession#', 'Billed Status', 'Payer Type', 'Claim Status', 'Claim No'];
                    if ( app.billingRegionCode === 'can_AB' ) {
                        defaultOptions.push('AHS Claim Num');
                    }
                    if (defaultOptions.indexOf(value) != -1) {
                        newCB.find('input[type=checkbox]').attr('data_name', screenName).addClass('chkBillFields').prop("disabled", "true").attr('checked', true);

                        if (!checkedFieldLength) {
                            this.checkedFields.push(field_order[i].id);
                        }
                    }

                    if (listID == 'ulSortBillingList') {
                        var screenName = field_order[i].screen_name;
                        newCB.find('input[type=checkbox]').attr('data_name', screenName).addClass('chkBillFields');
                    }
                    var inputText = document.createElement("input");
                    inputText.setAttribute("type", "hidden");
                    inputText.setAttribute("value", (field_order[i].width > 0) ? field_order[i].width : 0);

                    newLi.append(newCB);
                    newLi.append(inputText);
                    $('#' + listID).append(newLi);
                    if (_.includes(checkedGridFields, field_order[i].id)) {
                        newCB.find('input[type=checkbox]').attr('data_name', screenName).addClass('chkBillFields').attr('checked', true);
                    }
                }
                commonjs.processPostRender();
            },

            bindSettingColumns: function () {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/user_settings',
                    data: {
                        gridName: self.gridFilterName
                    },
                    success: function (data) {
                        if(data.error){
                            $('#divForm_Mysettings').hide();
                            $('#divAccess').show();
                            return;
                        }
                        var displayFields = [];
                        self.billingDisplayFields = [];
                        self.displayFieldChecked = [];
                        var result = data && data.length ? JSON.parse(data[0]) : {};
                        if (self.gridFilterName == 'claims')
                            self.billingDisplayFields = result.claim_management;
                        if (self.gridFilterName == 'studies')
                            self.billingDisplayFields = result.study_fields;
                        if (app.country_alpha_3_code === "can") {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (['clearing_house', 'patient_ssn', 'place_of_service'].indexOf(field.field_code) > -1)) }) || [];
                        } else {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && field.field_code == "payment_id" || field.field_code == "phn_alt_account" || field.field_code == "pid_alt_account" ) }) || [];
                        }

                        if (app.billingRegionCode !== "can_MB") {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (field.field_code == "can_mhs_microfilm_no")) }) || [];
                        }

                        if (app.billingRegionCode !== "can_AB") {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (field.field_code == "can_ahs_claim_no" || field.field_code == "claim_action")) }) || [];
                        }

                        if (app.billingRegionCode !== "can_BC") {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (field.field_code == "can_bc_claim_sequence_numbers")) }) || [];
                        }

                        if (['can_AB', 'can_BC', 'can_MB'].indexOf(app.billingRegionCode) == -1) {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (field.field_code == "phn_alt_account")) }) || [];
                        }

                        if (!app.isMobileBillingEnabled || app.country_alpha_3_code === "can") {
                            self.billingDisplayFields = _.reject(self.billingDisplayFields, function (field) { return (field && (['billing_type'].indexOf(field.field_code) > -1)) }) || [];
                        }

                        var result_data = data && data.length && data[1] && data[1].rows && data[1].rows.length ? data[1].rows[0] : {};
                        self.checkedBillingDisplayFields = result_data.field_order || [] ;
                        self.checkedFields = self.checkedBillingDisplayFields ? self.checkedBillingDisplayFields : [];
                        var billingDisplayFieldsFlag = false;

                        for (var i = 0; i < self.checkedBillingDisplayFields.length; i++) {
                            for (var j = 0; j < self.billingDisplayFields.length; j++) {
                                var currentDisplayField = self.billingDisplayFields[j];

                                if (self.checkedBillingDisplayFields[i] == currentDisplayField.id) {
                                    displayFields.push({
                                        field_name: currentDisplayField.field_name,
                                        i18n_name: currentDisplayField.i18n_name,
                                        width: currentDisplayField.field_info.width,
                                        id: self.checkedBillingDisplayFields[i],
                                        screen_name: opener,
                                        field_code: currentDisplayField.field_code
                                    });
                                    continue;
                                }

                            }
                        }
                        var gridNames = displayFields.map(function (field) {
                            return field.id;
                        });
                        $.grep(self.billingDisplayFields, function (obj) {
                            if ($.inArray(obj.id, gridNames) == -1) {
                                displayFields.push({
                                    field_name: obj.field_name,
                                    i18n_name: obj.i18n_name,
                                    width: obj.field_info.width,
                                    id: obj.id,
                                    screen_name: opener
                                });
                            }
                        });

                        self.ulListBinding(displayFields, 'ulSortList', self.checkedFields);

                        // Remove Billed status column in dropdown
                        self.billingDisplayFields = _.reject(self.billingDisplayFields, function (obj) {
                            return (!self.checkedFields.includes(obj.id) || obj.field_code === 'billed_status');
                        });

                        this.defaults = defaultFields(self.gridFilterName).toArray();

                        var nonSortColumn = $.map(this.defaults, function (data) {
                            return data.field_info && data.field_info.sortable === false ? data.field_code : null
                        });

                        /* eslint-disable no-redeclare */
                        for (var i = 0; i < self.billingDisplayFields.length; i++) {
                        /* eslint-enable no-redeclare */
                            var field = self.billingDisplayFields[i];

                            if (nonSortColumn.indexOf(field.field_code) === -1) {

                                if (result_data.default_column === field.field_code) {
                                    billingDisplayFieldsFlag = true;
                                }

                                var field_name = commonjs.geti18NString(field.i18n_name);
                                $('<option/>').val(field.field_code).html(field_name).appendTo('#ddlBillingDefaultColumns');
                            }
                        }

                        var defaultDisplayField = displayFields[0];
                        var defaultColumn = billingDisplayFieldsFlag ? result_data.default_column : defaultDisplayField && defaultDisplayField.field_code;
                        $('#ddlBillingDefaultColumns').val(defaultColumn);
                        $('#ddlBillingSortOrder').val(result_data.default_column_order_by);
                        self.loadPrinterTemplates('ddlPaperClaimFullForm', 'paper_claim_full', result_data.paper_claim_full);
                        self.loadPrinterTemplates('ddlPaperClaimOriginalForm', 'paper_claim_original', result_data.paper_claim_original);
                        self.loadPrinterTemplates('ddlDirectInvoice', 'direct_invoice', result_data.direct_invoice);
                        self.loadPrinterTemplates('ddlPatientInvoice', 'patient_invoice', result_data.patient_invoice);
                        self.loadPrinterTemplates('ddlSpecialForm', 'special_form', result_data.special_form);

                    },
                    error: function (err) {
                        if (err)
                            commonjs.showError('Error to Fetch the information...')
                    }
                });
            },

            loadPrinterTemplates : function(elID, templateType, templateValue) {
                var element = $('#' + elID);
                var printerTemplats = app.printer_templates.filter(function(template) {
                    return template.template_type == templateType && template.is_active;
                });

                if(printerTemplats && printerTemplats.length > 0) {
                    for(var i = 0; i < printerTemplats.length; i++) {
                        element.append($('<option/>', {value:printerTemplats[i].id}).html(printerTemplats[i].name));
                    }
                }

                element.val(templateValue);
            }
        });
    });
