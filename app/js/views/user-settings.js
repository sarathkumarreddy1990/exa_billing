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
                this.$el.html(_.template(userSettingsTemplate));
                var ulColumnList = $('#ulSortList');
                ulColumnList.sortable();
            },

            saveUserSettingsBilling: function () {
                var self = this;
                var claim_col_name = '';
                var claim_sort_order = '';
                var selectedFields = [];
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
                this.model.set({
                    flag: 'Claims',
                    userId: 5,
                    claim_col_name: claim_col_name,
                    claim_sort_order: claim_sort_order,
                    billingClaimGridFields: billingClaimGridFields,
                    claimFieldOrder: JSON.stringify(claimFieldOrder),
                    claimSettingFields: claimSettingFields
                });
                this.model.save({
                }, {
                        success: function (model, response) {

                        },
                        error: function (model, response) {
                            commonjs.handleXhrError(model, response);
                        }
                    });
            },

            ulListBinding: function (field_order, listID) {
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
                }
                commonjs.processPostRender();
            },

            showForm: function () {
                var self = this;
                userSettingsID = app.userID;
                $('#site_modal_div_container').empty();
                $('#divForm_Mysettings').css({
                    top: '10%',
                    height: '80%'
                });
                $('#divForm_Mysettings').css("left", '5%');
                $('#site_modal_div_container').append(template);
                $('#site_modal_div_container').show();
                this.bindSettingColumns();
                $('#close_settings').click(function (e) {
                    $('#site_modal_div_container').hide();
                });
                $('#save_settings').click(function (e) {
                    self.saveUserSettingsBilling();
                    $('#site_modal_div_container').hide();
                });
                if (userSettingsID == 0) {
                    this.model = new ModelUserSetting();
                }
                else {
                    this.model.set({ id: userSettingsID });
                }
            },

            bindSettingColumns: function () {
                var self = this;

                $.ajax({
                    url: '/exa_modules/billing/user_settings',
                    success: function (data, response) {
                        var displayFields = [];
                        self.billingDisplayFields = [];
                        self.billingDisplayFields = data.claim_management;
                        var gridFieldArray = [],
                            field_order = [];
                        var sortColumn, sortOrder;

                        for (var i = 0; i < self.billingDisplayFields.length; i++) {
                            displayFields.push({
                                field_name: self.billingDisplayFields[i].field_name,
                                i18n_name: self.billingDisplayFields[i].i18n_name,
                                width: self.billingDisplayFields[i].field_info.width,
                                id: self.billingDisplayFields[i].id
                            });
                        }
                        gridFieldArray = displayFields;
                        self.ulListBinding(displayFields, 'ulSortList');
                        $('#ulSortBillingList li').each(function () {
                            if (gridFieldArray) {
                                for (var i = 0; i < gridFieldArray.length; i++) {
                                    $(this).find('input[type=checkbox][value="' + gridFieldArray[i].field_name + '"]').each(
                                        function () {
                                            $(this).prop('checked', true);
                                        });
                                    checkedCount++;
                                }
                                for (var j = 0; j < gridFieldArray.length; j++) {
                                    if ($(this).find('input[type=checkbox]')[0].value == gridFieldArray[j].field_name) {
                                        $(this).find('input[type=hidden]')[0].value = gridFieldArray[j].width;
                                    }
                                }
                            }

                        });
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