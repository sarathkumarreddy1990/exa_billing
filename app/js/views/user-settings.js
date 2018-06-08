define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/user-settings.html',
    'models/user-settings'
], function (
    $,
    _,
    Backbone,
    userSettingsTemplate,
    ModelUserSetting) {
        return Backbone.View.extend({
            template: _.template(userSettingsTemplate),
            events: {
                "click #mySettings": "showForm",
                "click #close_settings": "closePopup",
                "click #save_settings": "saveUserSettingsBilling"

            },

            initialize: function () {
                self.template = _.template(userSettingsTemplate);
                this.model = new ModelUserSetting();
            },

            render: function () {
                // this.$el.html(_.template(userSettingsTemplate));
                // var ulColumnList = $('#ulSortList');
                // ulColumnList.sortable();

                var self = this;
                userID = app.userID;
                this.$el.html(template);

                $('#divForm_Mysettings').css({
                    top: '10%',
                    height: '80%'
                });
                $('#divForm_Mysettings').css("left", '5%');

                this.bindSettingColumns(userID);

                $('#save_settings').click(function (e) {
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
                claim_col_name = $('#ddlBillingDefaultColumns').val();
                claim_sort_order = $('#ddlBillingSortOrder').val();
                $('#ulSortList li').each(function () {
                    var input = $($(this).find('input[type=checkbox]')[0]);
                    claimFieldOrder.push(input.attr('id').split('~')[1]);
                    if (input.is(':checked')) {
                        claimSettingFields.push(input.attr('id').split('~')[1]);
                        billingClaimGridFields.push({ "name": input.val(), "id": input.attr('id').split('~')[1], "width": $(this).find('input[type=hidden]')[0].value });
                    }
                });
                if (window.location && window.location.hash.split('/')[1] == 'studies') {
                    var grid_name = 'studies';
                    var default_tab = 'All Studies';
                }
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench') {
                    var grid_name = 'claims';
                    var default_tab = 'All Claims';
                }
                this.model.set({
                    flag: grid_name,
                    default_tab: default_tab,
                    userId: userId,
                    claim_col_name: claim_col_name,
                    claim_sort_order: claim_sort_order,
                    billingClaimGridFields: billingClaimGridFields,
                    claimFieldOrder: JSON.stringify(claimFieldOrder),
                    claimSettingFields: claimSettingFields
                });
                this.model.save({},
                    {
                        success: function (model, response) {
                            commonjs.hideLoading();
                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            ulListBinding: function (field_order, listID, checkedGridFields) {
                var $ol = $('#' + listID),
                    $li, $label, $checkbox;
                $('#' + listID).empty();
                for (var i = 0; i < field_order.length; i++) {
                    var id = 'sf~' + field_order[i].id;
                    var value = field_order[i].field_name;
                    var i18nLabel = field_order[i].i18n_name;
                    var newLi = $('<li>');
                    var newCB = CreateCheckBox(value, id, i18nLabel);
                    var defaultOptions = ['Billing Method', 'Patient Name', 'Claim Date', 'Clearing House', 'Billing Provider'];
                    if (defaultOptions.indexOf(value) != -1)
                        newCB.find('input[type=checkbox]').attr('data_name', screenName).addClass('chkBillFields').prop("disabled", "true").attr('checked', true);
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
                    if (_.contains(checkedGridFields, field_order[i].id)) {
                        newCB.find('input[type=checkbox]').attr('data_name', screenName).addClass('chkBillFields').attr('checked', true);
                    }
                }
                commonjs.processPostRender();
            },

            showForm: function () {
                var self = this;
                userID = app.userID;
                $('#modal_div_container').empty();
                $('#divForm_Mysettings').css({
                    top: '10%',
                    height: '80%'
                });
                $('#divForm_Mysettings').css("left", '5%');
                $('#modal_div_container').append(template);
                $('#modal_div_container').show();
                this.bindSettingColumns(userID);
                $('#close_settings').click(function (e) {
                    $('#modal_div_container').hide();
                });
                $('#save_settings').click(function (e) {
                    self.saveUserSettingsBilling(userID);
                    $('#modal_div_container').hide();
                });
            },

            bindSettingColumns: function (userID) {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/user_settings',
                    data: {
                        userID: userID
                    },
                    success: function (data, response) {
                        var displayFields = [];
                        self.billingDisplayFields = [];
                        self.displayFieldChecked = [];
                        if (window.location && window.location.hash.split('/')[1] == 'claim_workbench') {
                            self.billingDisplayFields = JSON.parse(data[0]).claim_management;
                        }
                        if (window.location && window.location.hash.split('/')[1] == 'studies') {
                            self.billingDisplayFields = JSON.parse(data[0]).study_fields;
                        }
                        self.checkedBillingDisplayFields = data[1].rows[0] ? data[1].rows[0].field_order : 0;
                        var checkedGridFields = self.checkedBillingDisplayFields;
                        var gridFieldArray = [],
                            field_order = [];
                        var sortColumn, sortOrder;

                        for (var i = 0; i < self.billingDisplayFields.length; i++) {
                            displayFields.push({
                                field_name: self.billingDisplayFields[i].field_name,
                                i18n_name: self.billingDisplayFields[i].i18n_name,
                                id: self.billingDisplayFields[i].id
                            });
                        }
                        gridFieldArray = displayFields;
                        self.ulListBinding(displayFields, 'ulSortList', checkedGridFields);
                        for (var i = 0; i < self.billingDisplayFields.length; i++) {
                            $('<option/>').val(self.billingDisplayFields[i].field_name).html(self.billingDisplayFields[i].field_name).appendTo('#ddlBillingDefaultColumns');
                        }
                    },
                    error: function (err, response) {
                        if (err)
                            commonjs.showError('Error to Fetch the information...')
                    }
                });
            }

        });
    });