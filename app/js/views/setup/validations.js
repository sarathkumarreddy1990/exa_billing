define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/validation.html',
    'text!templates/setup/validation-group.html',
    'text!templates/setup/validation-item.html',
    'collections/setup/validations',
    'models/setup/validations',
    'models/pager'
],
function (
    $,
    _,
    Backbone,
    ValidationTemplate,
    ValidationGroupTemplate,
    ValidationItemTemplate,
    ValidationCollections,
    ValidationModel,
    Pager
) {
    var ValidationView = Backbone.View.extend({
        validationTemplate: _.template(ValidationTemplate),
        ValidationGroupTemplate: _.template(ValidationGroupTemplate),
        ValidationItemTemplate: _.template(ValidationItemTemplate),
        validateInfo: null,
        model: null,
        pager: null,
        events: {},

        // --------------------------------------------------------------------------------
        //                                INITIALIZE
        // --------------------------------------------------------------------------------

        initialize: function (options) {
            this.options = options;
            this.model = new ValidationModel();
            this.pager = new Pager();
            this.validateInfo = new ValidationCollections();
        },

        render: function () {
            $(this.el).html(this.validationTemplate());
            this.initScreen();
            this.fetchData();
            this.bindTabs();
        },

        initScreen: function () {
            commonjs.initializeScreen({
                header: {
                    screen: 'Validate',
                    ext: 'validate'
                },
                buttons: [{
                    value: 'Save',
                    type: 'submit',
                    class: 'btn btn-primary',
                    i18n: 'shared.buttons.save',
                    clickEvent: function () {
                        this.save();
                    }.bind(this)
                }]
            });
        },

        showAll: function () {
            this.render();
        },


        // --------------------------------------------------------------------------------
        //                                DATA MANAGEMENT
        // --------------------------------------------------------------------------------

        // Fetches data from the database and also the structure from json
        fetchData: function () {
            this.model.fetch({
                success: function (model, response) {
                    var db_data = response && response[0] || {};
                    this.id = db_data.id;

                    // Get the structure of the validation options
                    $.getJSON("billing/static/resx/validation_fields.json", function (struct_data) {
                        var applied_edi = this.reformatJson(this.mapSaveData(struct_data[0].edi_validation, db_data.edi_validation));
                        var applied_inv = this.reformatJson(this.mapSaveData(struct_data[0].invoice_validation, db_data.invoice_validation));
                        var applied_pat = this.reformatJson(this.mapSaveData(struct_data[0].patient_validation, db_data.patient_validation));
                        this.writeTabContents('electronic', applied_edi);
                        this.writeTabContents('invoice', applied_inv);
                        this.writeTabContents('patient', applied_pat);
                        commonjs.processPostRender();
                    }.bind(this));

                    // Activate the electronic validation tab by default
                    this.setTab("electronic");
                }.bind(this)
            });
        },

        // Gathers the checked boxes and formats that information for saving
        save: function () {
            var ediInfo = this.getAllTabItems("electronic");
            var invoiceInfo = this.getAllTabItems("invoice");
            var patientInfo = this.getAllTabItems("patient");

            this.model.set({
                "id": this.id,
                "companyId": app.companyID,
                "ediValidation": this.makeSaveJson(ediInfo),
                "invoiceValidation": this.makeSaveJson(invoiceInfo),
                "patientValidation": this.makeSaveJson(patientInfo)
            });

            this.model.save({}, {
                success: function (model, response) {
                    if (response) {
                        location.href = "#setup/validations/all";
                        commonjs.showStatus("Saved Succesfully")
                    }
                },
                error: function (model, response) {
                    commonjs.handleXhrError(model, response);
                }
            });
        },


        // --------------------------------------------------------------------------------
        //                                    WRITERS
        // --------------------------------------------------------------------------------

        /**
         * Writes all of the HTML and event binding under one of the tabs (electronic, Invoice or Patient)
         * 
         * @param {string} tab   Name of the tab to write
         * @param {object} data  Save data to write
         */
        writeTabContents: function (tab, data) {
            var $tab_area = this.getTabAreaEl(tab);

            for (group_key in data) {
                var group_data = data[group_key];
                if (!group_data.length) { continue; }

                // Group check-all box and label
                var $group = $(this.ValidationGroupTemplate({
                    id: tab + "_" + group_key,
                    group: group_key
                }));

                $tab_area.append($group);
                this.bindGroupEl($group);
                var $group_items = this.getGroupItemsEl(tab, group_key);

                // All validation items within this group
                for (var i = 0; i < group_data.length; i++) {
                    var item_data = group_data[i];
                    if (!item_data.show) { continue; }

                    var $item = $(this.ValidationItemTemplate({
                        id: tab + "_" + item_data.field,
                        checked: item_data.enabled,
                        i18n: item_data.field
                    }));

                    $group_items.append($item);
                    this.bindItemEl($item);
                }

                // Need to wait until the items are checked before we set the group box
                this.setGroupCheckbox(tab, group_key);
            }
        },

        // --------------------------------------------------------------------------------
        //                                   FORMATTERS
        // --------------------------------------------------------------------------------

        /**
         * Sets the "enabled" property to true in the structure object based on what's in the save data 
         *    Field will show if ...
         *       1. No "show" property is specified in the item's structure
         *       2. Show property is an empty array
         *       3. One of the array elements exactly matches the country code
         *       4. One of the array elements exactly matches the Billing Region Code (i.e. country_province)
         *       5. One of the array elements contains "not_" but no element matches "not_country" or "not_billingRegionCode"
         * 
         * @param {object} structure  Field structure
         * @param {object} save_data  Save data.  Contains only enabled fields
         */
        mapSaveData: function (structure, save_data) {
            return structure.map(function (item) {
                var contains_not = (item.show && item.show.length)
                    ? !!item.show.filter(function (show_item) { return show_item.indexOf("not_") > -1 }).length
                    : false;

                return {
                    contains_not: contains_not,
                    field: item.field,
                    enabled: !!save_data.filter(function (save_item) { return save_item.field === item.field && save_item.enabled }).length,
                    show: (
                        !item.show ||
                        !item.show.length ||
                        item.show.indexOf(app.country_alpha_3_code) > -1 ||
                        item.show.indexOf(app.billingRegionCode) > -1 ||
                        (contains_not && item.show.indexOf("not_" + app.country_alpha_3_code) === -1 && item.show.indexOf("not_" + app.billingRegionCode) === -1)
                    )
                }
            })
        },

        // Reformats the data into groups
        reformatJson: function (data) {
            var group = {
                billingGrp: [],
                claimGrp: [],
                insuranceGrp: [],
                patientGrp: [],
                readingGrp: [],
                refferingGrp: [],
                claimServiceGrp: [],
                serviceGrp: [],
                subscriberGrp: [],
                payerGrp: []
            };

            if (typeof data == "string") {
                data = JSON.parse(data);
            }

            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                var field = item.field || "";

                if (field.indexOf("billing") > -1) {
                    group.billingGrp.push(item);
                } else if (field.indexOf("claim") > -1) {
                    group.claimGrp.push(item);
                } else if (field.indexOf("insurance") > -1) {
                    group.insuranceGrp.push(item);
                } else if (field.indexOf("patient") > -1) {
                    group.patientGrp.push(item);
                } else if (field.indexOf("reading") > -1) {
                    group.readingGrp.push(item);
                } else if (field.indexOf("ref") > -1) {
                    group.refferingGrp.push(item);
                } else if (field.indexOf("line_dig1") > -1) {
                    group.claimServiceGrp.push(item);
                } else if (field.indexOf("service") > -1) {
                    group.serviceGrp.push(item);
                } else if (field.indexOf("subscriber") > -1) {
                    group.subscriberGrp.push(item);
                } else if (field.indexOf("payer") > -1) {
                    group.payerGrp.push(item);
                }
            }

            return group;
        },

        // Converts the HTML checkbox values into savable json format
        makeSaveJson: function (obj) {
            return obj.map(function (index, field) {
                if (field.checked) {
                    return {
                        "field": field.getAttribute("id").split("_").slice(1).join("_"),  // Remove the tab prefix at the beginning of each item id
                        "enabled": true
                    }
                }
            }).toArray();
        },

        // --------------------------------------------------------------------------------
        //                                GETTERS & SETTERS
        // --------------------------------------------------------------------------------

        /**
         * Retrieves the dom element for a tab
         * 
         * @param {string} tab  Data attribute to identify the desired tab
         */
        getTabEl: function (tab) {
            return $(".validateTags[data-tab='" + tab + "']");
        },

        /**
         * Retrieves the dom element for a tab content area
         * 
         * @param {string} tab  Data attribute to identify the desired tab
         */
        getTabAreaEl: function (tab) {
            return $(".validateInfoSpace[data-tab='" + tab + "']");
        },

        /**
         * Retrieves the dom element for an group within a tab
         * 
         * @param {string} tab    Data attribute to identify the desired tab
         * @param {string} group  Data attribute to identify the desired group within said tab
         */
        getGroupEl: function (tab, group) {
            return this.getTabAreaEl(tab).find(".validation_group[data-group='" + group + "']");
        },

        /**
         * Retrieves the dom element for the items within a group within a tab
         * 
         * @param {string} tab    Data attribute to identify the desired tab
         * @param {string} group  Data attribute to identify the desired group within said tab
         */
        getGroupItemsEl: function (tab, group) {
            return this.getGroupEl(tab, group).find(".validation_group_items");
        },

        /**
         * Retrieves all of the checkboxes within a tab within a group
         * 
         * @param {string} tab    Data attribute to identify the desired tab
         * @param {string} group  Data attribute to identify the desired group within said tab
         */
        getAllGroupItems: function (tab, group) {
            return this.getGroupItemsEl(tab, group).find(":input");
        },

        /**
         * Retrieves all of the checkboxes within a tab
         * 
         * @param {string} tab    Data attribute to identify the desired tab
         */
        getAllTabItems: function (tab) {
            return this.getTabAreaEl(tab).find(".validation_group_items").find(":input");
        },

        // Sets the tab area
        setTab: function (tab) {
            this.highlightTab(tab);
            this.setTabArea(tab);
        },

        // Sets the tab area
        setTabArea: function (tab) {
            this.getTabAreaEl(tab)
                .show()
                .siblings()
                .hide();
        },

        // Sets the highlight on the active tab and removes other highlights
        highlightTab: function (tab) {
            this.getTabEl(tab)
                .addClass("activeValTag")
                .siblings()
                .removeClass("activeValTag");
        },

        /**
         * Checks or unchecks a group's "select all" checkbox based on whether all of the items are checked or not
         *    Check group box if all items checked
         *    Uncheck group box if at least one item is not checked
         * 
         * @param {string} tab    Data attribute to identify the desired tab
         * @param {string} group  Data attribute to identify the desired group within said tab
         */
        setGroupCheckbox: function (tab, group) {
            var $group = this.getGroupEl(tab, group);
            var unchecked_count = this.getGroupItemsEl(tab, group).find("input:checkbox:not(:checked)").length;
            $group.find("input:first").prop("checked", !unchecked_count);
        },


        // --------------------------------------------------------------------------------
        //                                EVENT BINDING
        // --------------------------------------------------------------------------------

        // Bind events to tabs
        bindTabs: function () {
            this.getTabEl("electronic").click(function () {
                this.setTab("electronic");
            }.bind(this));

            this.getTabEl("invoice").click(function () {
                this.setTab("invoice");
            }.bind(this));

            this.getTabEl("patient").click(function () {
                this.setTab("patient");
            }.bind(this));
        },

        /**
         * Event binding for the group checkboxes
         * 
         * @param {jQuery} $group  DOM element 
         */
        bindGroupEl: function ($group) {
            $group.find("input").click(function (e) {
                var $chk_group = $(this);
                var $chk_items = $chk_group.closest(".validation_group").find(".validation_item");
                var checked = $chk_group.prop("checked");

                // Check or uncheck every checkbox within the group container div
                $chk_items.each(function (index, el) {
                    $(el).prop('checked', checked);
                });
            });
        },

        /**
         * Event binding for the validation items
         * 
         * @param {jQuery} $item  DOM element 
         */
        bindItemEl: function ($item) {
            var self = this;

            $item.find("input").click(function (e) {
                var $chk_item = $(this);
                var tab = $chk_item.closest(".validateInfoSpace").data("tab");
                var group = $chk_item.closest(".validation_group").data("group");
                self.setGroupCheckbox(tab, group);
            });
        }
    });

    return ValidationView;
});
