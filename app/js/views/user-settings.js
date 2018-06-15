define([
    'jquery',
    'underscore',
    'backbone',
    'jquerysortable',
    'text!templates/user-settings.html',
    'models/user-settings'
], function (
    $,
    _,
    Backbone,
    jquerysortable,
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

                var height = $('#modal_div_container').height() - 70;
                $("#ulSortList").css('height', height);
                this.bindSettingColumns(userID);
                $(".simple_with_animation").sortable();
                $('#save_settings').click(function (e) {
                    self.saveUserSettingsBilling(userID);
                    commonjs.hideDialog();
                    $('#siteModal').on('hidden.bs.modal', function (e) {
                        $('#btnRefreshAll').click();
                    })
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
                if (window.location && window.location.hash.split('/')[1] == 'claim_workbench') 
                    var grid_name = 'claims'
                else
                    var grid_name = 'studies'
                $.ajax({
                    url: '/exa_modules/billing/user_settings',
                    data: {
                        userID: app.userID,
                        gridName: grid_name
                    },
                    success: function (data, response) {
                        var displayFields = [];
                        self.billingDisplayFields = [];
                        self.displayFieldChecked = [];
                        var result =  data && data.length ? JSON.parse(data[0]) : {};
                        if (window.location && window.location.hash.split('/')[1] == 'claim_workbench') 
                            self.billingDisplayFields = result.claim_management;                        
                        if (window.location && window.location.hash.split('/')[1] == 'studies') 
                            self.billingDisplayFields = result.study_fields;
                        var result_data = data && data.length && data[1] && data[1].rows && data[1].rows.length ? data[1].rows[0] : {};
                        self.checkedBillingDisplayFields = result_data.field_order;
                        var checkedGridFields = self.checkedBillingDisplayFields;
                        var gridFieldArray = [],
                            field_order = [];
                        var sortColumn, sortOrder;
                        var displayField = [];

                        for (var i = 0; i < self.checkedBillingDisplayFields.length; i++) {
                            for (var j = 0; j < self.billingDisplayFields.length; j++) {
                                if (self.checkedBillingDisplayFields[i] == self.billingDisplayFields[j].id) {
                                    displayFields.push({
                                        field_name: self.billingDisplayFields[j].field_name,
                                        i18n_name: self.billingDisplayFields[j].i18n_name,
                                        width: self.billingDisplayFields[j].field_info.width,
                                        id: self.checkedBillingDisplayFields[i],
                                        screen_name: opener
                                    });
                                    continue;
                                }
                            }
                        }
                        var gridNames = displayFields.map(function ( field ) {
                            return field.id;
                        });
                        var remainingFields = $.grep(self.billingDisplayFields, function (obj) {
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

                        self.ulListBinding(displayFields, 'ulSortList', checkedGridFields);

                        for (var i = 0; i < self.billingDisplayFields.length; i++) {
                            $('<option/>').val(self.billingDisplayFields[i].field_code).html(self.billingDisplayFields[i].field_name).appendTo('#ddlBillingDefaultColumns');
                        }

                        $('#ddlBillingDefaultColumns').val(result_data.default_column);
                        $('#ddlBillingSortOrder').val(result_data.default_column_order_by);                        
                    },
                    error: function (err, response) {
                        if (err)
                            commonjs.showError('Error to Fetch the information...')
                    }
                });
            }

        });
    });