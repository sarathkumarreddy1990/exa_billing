define([
    "jquery",
    "underscore",
    "backbone",
    "shared/dtp-storage",
    "views/claims/insuranceImagineSoftware",
    "text!templates/claims/insuranceEligibility.html",
    "text!templates/claims/insurancePokitdokpopup.html",
    "text!templates/claims/eligibilityResponseInfo.html",
    "text!templates/claims/eligibilityResponseOhip.html",
    "text!templates/claims/eligibilityResponseBC.html",
    "text!templates/claims/eligibilityErrorTemplate.html"
],
function (
    $,
    _,
    Backbone,
    dtpStore,
    InsuranceImagineSoftwareView,
    InsuranceEligibilityTemplate,
    InsurancePokitdokForm,
    InsuranceUsaForm,
    InsuranceOhipForm,
    InsuranceBcForm,
    EligibilityErrorTemplate
) {
    var insuranceEligibility = Backbone.View.extend({
        el: null,
        rendered: false,
        order_id: null,
        patient_insurance_id: null,
        coverage_level: null,
        data: null,
        insuranceImagineSoftwareView: null,
        template: _.template(InsuranceEligibilityTemplate),
        insurancePokitdokTemplateForm: _.template(InsurancePokitdokForm),
        insuranceUsaTemplate: _.template(InsuranceUsaForm),
        insuranceOhipTemplate: _.template(InsuranceOhipForm),
        insuranceBcTemplate: _.template(InsuranceBcForm),
        eligibilityErrorTemplateForm: _.template(EligibilityErrorTemplate),

        /* #region Event Handlers */
        // --------------------------------------------------------------------------------
        //                                 EVENT HANDLERS
        // --------------------------------------------------------------------------------

        events: {
            "click .btn-eligibility": "handleClickCheckEligibility"
        },

        /**
         * Click handler for the Check Eligibility / View Estimate button
         *
         * @param {object} e
         */
        handleClickCheckEligibility: function (e) {
            this.loadInsuranceEligibility();
        },
        /* #endregion */

        /* #region Initializations */
        // --------------------------------------------------------------------------------
        //                                 INITIALIZATIONS
        // --------------------------------------------------------------------------------

        /**
         * Auto-runs before the entry point
         *
         * @param {object} options
         */
        initialize: function (options) {
            this.options = options;
        },

        /**
         * Initializes the Benefits On Date DTP
         */
        initializeDateTimePickers: function () {
            dtpStore
                .initialize("benefit", "divBenefitOnDate" + this.key)
                .set("benefit", commonjs.getCompanyCurrentDateTime());

            return this;
        },

        /**
         * Initializes global view variables on render
         *
         * @param {object} args
         * @prop  {number} args.order_id
         * @prop  {number} args.patient_insurance_id
         * @prop  {string} args.coverage_level
         * @prop  {string} args.orientation
         * @prop  {object} args.parent_view
         * @prop  {string} args.getter_function_name
         */
        initGlobalVariables: function (args) {
            this.rendered = true;
            this.order_id = ~~args.order_id;
            this.patient_insurance_id = ~~args.patient_insurance_id;
            this.coverage_level = args.coverage_level || "";
            this.key = _.capitalize(this.coverage_level);
            this.parent_view = args.parent_view || null;
            this.getter_function_name = args.getter_function_name || "";

            this.template_options = {
                key: this.key,
                btnI18n: this.buttonI18n(),
                show_service_type: !!args.show_service_type,
                show_benefits_on_date: !!args.show_benefits_on_date,
                container_class: args.container_class || ""
            }

            return this;
        },

        /**
         * Returns the button i18n string based on the coverage level
         *
         * @returns {string}
         */
        buttonI18n: function () {
            return this.coverage_level === "primary"
                ? "shared.fields.eligibilityEstimation"
                : "shared.fields.eligibility";
        },

        /**
         * Entry point for this view
         *
         * @param {object} args
         * @prop  {number} args.order_id
         * @prop  {number} args.patient_insurance_id
         * @prop  {string} args.coverage_level
         */
        render: function (args) {
            args = args || {};
            console.log("RENDER", args)

            var self = this;

            if (!this.rendered) {
                this.initGlobalVariables(args);

                $(this.el).html(this.template({
                    data: this.template_options
                }));

                if (args.show_service_type) {
                    this.initializeDateTimePickers();
                    this.fetchServiceTypes(function (data) {
                        self.buildServiceTypesDropdown(data);
                    });
                }
            }

            this.fetchOrderData();
            commonjs.updateCulture();

            return this;
        },
        /* #endregion */

        /* #region Load Data */
        // --------------------------------------------------------------------------------
        //                                    LOAD DATA
        // --------------------------------------------------------------------------------

        /**
         * Validate AND save insurance eligibility for British Columbia
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchEligibilityBc: function (callback) {
            if (!this.validateEligibilityBc()) {
                return callback({});
            }

            callback = commonjs.ensureCallback(callback);
            commonjs.showLoading();

            $.ajax({
                url: "/exa_modules/billing/bc/validateHealthCard",
                type: "GET",
                data: {
                    patient_id: this.data.patient_id,
                    patient_insurance_id: this.data.patient_insurance_id,
                    eligibility_dt: dtpStore.get("benefit", "YYYY-MM-DD") || moment().format("YYYY-MM-DD"),
                    phn: this.data.phn_alt_account_no,
                    birth_date: this.data.patient_birth_date,
                    facility_id: app.default_facility_id
                },
                success: function (result) {
                    commonjs.hideLoading();
                    return callback(result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
                }
            });
        },

        /**
         * Validate AND save insurance eligibility for OHIP
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchEligibilityOhip: function (callback) {
            if (!this.validateEligibilityOhip()) {
                return callback({});
            }

            callback = commonjs.ensureCallback(callback);
            commonjs.showLoading();

            $.ajax({
                url: "/exa_modules/billing/ohip/validateHealthCard",
                type: "GET",
                data: {
                    healthNumber: this.data.policy_number,
                    versionCode: this.data.group_number,
                    patient_id: this.data.patient_id,
                    patient_insurance_id: this.data.patient_insurance_id
                },
                success: function (result) {
                    commonjs.hideLoading();
                    return callback(result);
                },
                error: function (request, status, error) {
                    commonjs.handleXhrError(request);
                    return callback({});
                }
            });
        },

        /**
         * Validate AND save insurance eligibility for the United States
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchEligibilityPokitdok: function (callback) {
            if (!this.validateEligibilityUsa()) {
                return this;
            }

            var self = this;

            callback = commonjs.ensureCallback(callback);
            this.stateLoading(true);
            commonjs.showLoading();

            $.ajax({
                url: "/eligibility",
                type: "POST",
                dataType: "json",
                data: {
                    Sender: "",
                    AuthKey: "",
                    APIOrgCode: "",
                    InsuranceCompanyCode: "-1",
                    ProviderCode: "-1",
                    EntityType: "1",
                    NpiNo: this.data.facility_npi_no,
                    FederalTaxID: this.data.federal_tax_id || "",
                    billing_provider_name: this.data.billing_provider_name,
                    billing_provider_npi_no: this.data.billing_provider_npi_no,
                    BenefitOnDate: dtpStore.get("benefit", "YYYY-MM-DD") || moment().format("YYYY-MM-DD"),
                    LastName: this.data.subscriber_lastname,
                    FirstName: this.data.subscriber_firstname,
                    address: this.data.subscriber_address_line1,
                    PolicyNo: this.data.policy_number,
                    BirthDate: this.data.subscriber_dob,
                    RelationshipCode: this.data.subscriber_relationship_id,
                    ServiceTypeCodes: this.serviceTypeCodes(),
                    ServiceTypes: this.serviceTypes(),
                    TradingPartnerID: this.data.trading_partner_id || "",
                    PayorID: this.data.payer_id,
                    InsuranceCompanyName: this.data.insurance_name,
                    FromLocal: "false",
                    ResponseType: "html",
                    patient_id: this.data.patient_id,
                    patient_insurance_id: this.data.patient_insurance_id,
                    isExistingInsurance: true
                },
                success: function (response) {
                    commonjs.hideLoading();
                    self.stateLoading(false);

                    var data = response && response.result || {};
                    self.subscriber_report = data.DetailedReport;

                    return callback(data);
                },
                error: function (response) {
                    commonjs.hideLoading();
                    self.openEligibilityErrorUsa(response);
                    self.stateLoading(false);

                    return callback({});
                }
            });

            return this;
        },

        /**
         * Fetches the order and insurance data needed to make an eligibility request
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchOrderData: function (callback) {
            callback = commonjs.ensureCallback(callback);

            if (!this.order_id) {
                return callback({});
            }

            var self = this;
            commonjs.showLoading();

            $.ajax({
                url: "/insuranceEligibilityOrder",
                type: "GET",
                data: {
                    order_id: this.order_id,
                    patient_insurance_id: this.patient_insurance_id,
                    coverage_level: this.coverage_level
                },
                success: function (response) {
                    commonjs.hideLoading();

                    var data = _.get(response, "result[0]", {});
                    self.setOrderData(data);

                    return callback(data);
                },
                error: function (request) {
                    commonjs.handleXhrError(request);
                    return callback();
                }
            });
        },

        /**
         * Fetches the most recently stored eligibility report
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchLatestReport: function (callback) {
            callback = commonjs.ensureCallback(callback);
            commonjs.showLoading();

            $.ajax({
                url: "/getLatestEligibility",
                type: "GET",
                data: {
                    patient_id: this.data.patient_id,
                    patient_insurance_id: this.data.patient_insurance_id
                },
                success: function (response) {
                    commonjs.hideLoading();
                    return callback(response);
                },
                error: function (request) {
                    commonjs.handleXhrError(request);
                    return callback({});
                }
            });
        },

        /**
         * Fetches service type data
         *
         * @param {function} callback
         * @returns {function}
         */
        fetchServiceTypes: function (callback) {
            callback = commonjs.ensureCallback(callback);

            var self = this;
            commonjs.showLoading();

            $.ajax({
                url: "/settings",
                type: "GET",
                dataType: "json",
                data: {
                    customArgs: {
                        flag: 'EligibilityServiceTypes',
                        id: 0
                    }
                },
                success: function (response) {
                    commonjs.hideLoading();
                    var data = response && response.result || [];
                    return callback(data);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
                }
            });
        },
        /* #endregion */

        /* #region Save Data */
        // --------------------------------------------------------------------------------
        //                                    SAVE DATA
        // --------------------------------------------------------------------------------
        /* #endregion */

        /* #region Functionality */
        // --------------------------------------------------------------------------------
        //                                  FUNCTIONALITY
        // --------------------------------------------------------------------------------

        /**
         * Constructs the Service Types select box options and turns it
         * into a multi-select box.
         *
         * @param {object} data  EligibilityServiceTypes data
         */
        buildServiceTypesDropdown: function (data) {
            data = commonjs.ensureArray(data || []);

            // Build dropdown
            var $ddlServiceType = $("#ddlServiceType" + this.key)
            var $options = data.map(function (item) {
                return $("<option/>")
                    .val(item.code)
                    .text(item.description + " (" + item.code + ")")
                    .attr("title", item.description);
            });

            $ddlServiceType.html($options);

            // Make multi-select
            $ddlServiceType.multiselect({
                nonSelectedText: i18n.get("shared.buttons.noneSelected"),
                maxHeight: 200,
                enableFiltering: true,
                enableCaseInsensitiveFiltering: true,
                onInitialized: function ($select, $container) {
                    $('.dropdown-toggle', $container).dropdown();
                    $(document).mousedown(function (e) {
                        var ul = $('ul', $container);
                        if (!ul.is(e.target) && !ul.has(e.target).length && $container.hasClass('open')) {
                            $container.removeClass('open');
                        }
                    });
                }
            });

            $ddlServiceType
                .multiselect("deselectAll", false)
                .multiselect("refresh");

            return this;
        },

        /**
         * Figures out which insurance eligibility fetch method to call
         */
        loadInsuranceEligibility: function () {
            var self = this;

            this.setDataFromParentView();

            // OHIP
            if (app.billingRegionCode === "can_ON") {
                return this.fetchEligibilityOhip(function (result) {
                    if (result) {
                        var insurance_data = self.formatInsuranceDataOhip(result.data);
                        return self.openReportOhip(insurance_data);
                    }

                    return commonjs.showWarning("messages.status.enterValidHealthcardDetails", "largestatus");
                });
            }

            // BC
            if (app.billingRegionCode === "can_BC") {
                return this.fetchEligibilityBc(function (result) {
                    if (result.data) {
                        var insurance_data = self.formatInsuranceDataBc(result.data);
                        return self.openReportBc(insurance_data);
                    }

                    return self.showErrorBc(result.responseCode);
                });
            }

            // USA
            if (app.insImagineSoftware) {
                return this.openImagineSoftwareEligibility();
            }

            return this.fetchEligibilityPokitdok(function (data) {
                if (data.insPokitdok) {
                    return self.openPokitdok(data);
                }

                if (data.error && _.get(data, "sys.data.errors")) {
                    return self.openPokitdokError(data);
                }

                return self.openReportGeneral();
            });
        },

        /**
         * When an order_id is not available because an order hasn't been created yet, the data
         * must be retrieved from the parent view.  The parent view passes a reference to itself
         * and the name of a function used to retrieve the data.
         */
        setDataFromParentView: function () {
            if (this.parent_view && this.getter_function_name) {
                var set_data = this.parent_view[this.getter_function_name](this.coverage_level);
                this.setOrderData(set_data);
            }

            return this;
        },

        /**
         * Opens an error modal when a request comes back in error for USA
         */
        openEligibilityErrorUsa: function () {
            var error_obj = request.responseText ? JSON.parse(request.responseText) : {};
            var error_main = _.get(error_obj, "sys.data.errors");
            var error_table = error_main && eligibilityErrorTemplateForm({ "error_obj": error_main });
            var error_alt = _.get(error_obj, "sys.error");
            var error_last_resort = "Error: " + error_obj.error;

            commonjs.showNestedDialog({
                header: this.subscriberNameHeader(),
                width: "75%",
                height: "70%",
                html: error_table || error_alt || error_last_resort
            });

            return this;
        },

        /**
         * Opens the Imagine Software's eligibility / estimation modal
         */
        openImagineSoftwareEligibility: function () {
            if (!this.validateEligibilityImagineSoftware()) {
                return this;
            }

            commonjs.showNestedDialog({
                header: "Eligibility / Estimation",
                i18nHeader: this.buttonI18n(),
                width: "90%",
                height: "75%",
                html: "<div id='divImagineSoftware'></div>"
            });

            this.insuranceImagineSoftwareView = new InsuranceImagineSoftwareView({
                el: "#divImagineSoftware"
            });
            this.insuranceImagineSoftwareView.render(this.imagineSoftwareData());

            return this;
        },

        /**
         * Opens the Pokitdok modal
         *
         * @param {object} data
         */
        openPokitdok: function (data) {
            var self = this;

            commonjs.showNestedDialog({
                header: "Insurance Benefits",
                i18nHeader: "patient.patientInsurance.insuranceBenefits",
                width: "75%",
                height: "65%",
                html: this.insurancePokitdokTemplateForm({
                    "InsuranceData": data.data,
                    "InsuranceDatavalue": data.meta
                })
            });

            $("#btnPrintInsuranceEligibility" + this.key).off("click").click(function () {
                self.printInsuranceEligibility(data.data);
            });

            return this;
        },

        /**
         * Opens the Pokitdok error modal
         *
         * @param {object} data
         */
        openPokitdokError: function (data) {
            var $failedReasons = $("#bodyFailedReasons");
            var errors = _.get(data, "sys.data.errors", []);

            $failedReasons.empty();

            $.each(errors, function (key, data) {
                var tr = $("<tr></tr>")
                    .append($("<td></td>").text(key))
                    .append($("<td></td>").text(JSON.stringify(data)));

                $failedReasons.append(tr);
            });

            commonjs.showNestedDialog({
                header: "Eligibility Response",
                width: "75%",
                height: "65%",
                html: $("#divPokitdokError").html()
            });

            return this;
        },

        /**
         * Figures out which report to display
         *
         * @param {object} response
         */
        openReport: function (response) {
            var data = _.get(response, "result[0]");

            // BC
            if (app.billingRegionCode === "can_BC") {
                var insurance_data = {};  // Not sure what data format will be

                if (_.isEmpty(insurance_data)) {
                    commonjs.showWarning("messages.status.healthCardValidationHistoryNotFound");
                    return this;
                }

                return this.openReportBc(insurance_data);
            }

            // OHIP
            if (app.billingRegionCode === "can_ON") {
                var res = data.eligibility_response;
                var insurance_data = (
                    _.get(res, "results[0]") ||
                    _.get(res, "faults[0]")  ||
                    _.get(res, "err[0]")     ||
                    {}
                );

                if (_.isEmpty(insurance_data)) {
                    commonjs.showWarning("messages.status.healthCardValidationHistoryNotFound");
                    return this;
                }

                return this.openReportOhip(insurance_data);
            }

            // USA
            if (data) {
                return this.openReportUsa(data.eligibility_response);
            }

            // General
            if (this.subscriber_report) {
                return this.openReportGeneral();
            }

            commonjs.showWarning("messages.status.pokitdokEligibilityHistoryNotFound");

            return this;
        },

        /**
         * View report for BC
         *
         * @param {object} insurance_data
         */
        openReportBc: function (insurance_data) {
            commonjs.showNestedDialog({
                header: "Healthcard Eligibility Result",
                i18nHeader: "menuTitles.patient.patientInsuranceEligibility",
                height: "75%",
                width: "70%",
                html: this.insuranceBcTemplate({
                    insuranceData: insurance_data,
                    firstName: this.data.subscriber_firstname,
                    lastName: this.data.subscriber_lastname,
                    healthNumber: this.data.phn_alt_account_no,
                    gender: this.data.patient_gender
                })
            });

            return this;
        },

        /**
         * View general / generic report (Non-region specific)
         */
        openReportGeneral: function () {
            commonjs.showDialog({
                header: this.subscriberNameHeader(),
                width: "75%",
                height: "70%",
                html: '<div class="full-screen p-20">' + this.subscriber_report + '</div>'
            });

            return this;
        },

        /**
         * View report for OHIP
         *
         * @param {object} data  Report data
         */
        openReportOhip: function (data) {
            commonjs.showDialog({
                header: "Healthcard Eligibility Result",
                i18nHeader: "menuTitles.patient.patientInsuranceEligibility",
                width: "75%",
                height: "70%",
                html: this.insuranceOhipTemplate({
                    "insuranceData": data
                })
            });

            return this;
        },

        /**
         * View report for United States
         *
         * @param {object} data  Report data
         */
        openReportUsa: function (data) {
            var self = this;

            commonjs.showDialog({
                header: "Insurance Benefits",
                i18nHeader: "patient.patientInsurance.insuranceBenefits",
                width: "75%",
                height: "70%",
                html: this.insurancePokitdokTemplateForm({
                    "InsuranceData": data.data,
                    "InsuranceDatavalue": data.meta
                })
            });

            $("#btnPrintInsuranceEligibility" + this.key).off("click").click(function () {
                self.printInsuranceEligibility(data);
            });

            return this;
        },

        /**
         * Print non-third party eligibility
         */
        printInsuranceEligibility: function (data) {
            console.log("PRINT", data);
            // Construct print view from template
            // commonjs.print(html);

            return this;
        },
        /* #endregion */

        /* #region DOM Manipulation */
        // --------------------------------------------------------------------------------
        //                                 DOM MANIPULATION
        // --------------------------------------------------------------------------------

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledDate: function () {
            var disabled = this.readOnlyNoEligibility();
            dtpStore.setStateEnabled("benefit", !disabled);

            return this;
        },

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledButton: function () {
            var disabled = this.readOnlyNoEligibility();
            $(".btn-eligibility").prop("disabled", disabled);

            return this;
        },

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledServiceTypes: function () {
            var state = this.readOnlyNoEligibility()
                ? "disable"
                : "enable";
            $("#ddlServiceType" + this.key).multiselect(state);

            return this;
        },

        /**
         * Hides or shows the check eligibility buttons and loading gif
         *
         * @param {boolean} is_loading
         */
        stateLoading: function (is_loading) {
            var $button = $(".eligibility-button");
            var $loader = $(".eligibility-loader");

            if (this.key) {
                $button = $button.find("[data-key='" + this.key + "']");
                $loader = $loader.find("[data-key='" + this.key + "']");
            }

            if (is_loading) {
                $button.hide();
                $loader.show();
            }
            else {
                $loader.hide();
                $button.show();
            }

            return this;
        },
        /* #endregion */

        /* #region Validators */
        // --------------------------------------------------------------------------------
        //                                    VALIDATORS
        // --------------------------------------------------------------------------------

        /**
         * Shows a report error for BC
         *
         * @param {string} err_code
         */
        showErrorBc: function (err_code) {
            switch (err_code) {
                case "error":
                    commonjs.showWarning("messages.status.enterValidHealthCardDetails", "largestatus");
                    break;
                case "isDownTime":
                    commonjs.showWarning("messages.status.downTime");
                    break;
                case "credentialsMissing":
                    commonjs.showWarning("messages.status.credentialsMissing");
                    break;
            }

            return this;
        },

        /**
         * Indicates if insurance eligibility for British Columbia is valid
         *
         * @returns {boolean}
         */
        validateEligibilityBc: function () {
            if (!this.data) {
                return false;
            }

            if (this.invalidPrimaryInsurance()) {
                return commonjs.showWarning("messages.warning.claims.selectPriInsurance");
            }

            if (this.invalidInsuranceBc()) {
                return commonjs.showWarning("messages.warning.shared.invalidInsurance");
            }

            if (this.invalidPhn()) {
                return commonjs.showWarning("messages.warning.phn");
            }

            return true;
        },

        /**
         * Indicates if insurance eligibility for Imagine Software is valid
         *
         * @returns {boolean}
         */
        validateEligibilityImagineSoftware: function () {
            if (!this.data) {
                return false;
            }

            if (this.invalidPatient()) {
                return commonjs.showWarning("patient.patientInsurance.eligibility.selectPatient");
            }

            if (this.invalidStudies()) {
                return commonjs.showWarning("patient.patientInsurance.eligibility.addStudies");
            }

            if (this.invalidPrimaryInsurance()) {
                return commonjs.showWarning("messages.warning.claims.selectPriInsurance");
            }

            return true;
        },

        /**
         * Indicates if insurance eligibility for OHIP is valid
         *
         * @returns {boolean}
         */
        validateEligibilityOhip: function () {
            if (!this.data) {
                return false;
            }

            if (this.invalidHealthNumber()) {
                return commonjs.showWarning("messages.warning.shared.invalidHealthNumber");
            }

            if (this.invalidPrimaryInsurance()) {
                return commonjs.showWarning("messages.warning.claims.selectPriInsurance");
            }

            if (this.invalidEligibilityCheck()) {
                return commonjs.showWarning("messages.warning.shared.invalidEligibilityCheck");
            }

            return true;
        },

        /**
         * Indicates if insurance eligibility for the United States is valid
         *
         * @returns {boolean}
         */
        validateEligibilityUsa: function () {
            if (!this.data) {
                return false;
            }

            if (this.invalidServiceType()) {
                return commonjs.showWarning("messages.warning.shared.selectservicetype");
            }

            if (this.invalidEligibilityDisabled()) {
                return commonjs.showWarning("messages.warning.patient.eleigibilitycheckdisabled");
            }

            if (this.invalidNpi()) {
                return commonjs.showWarning("messages.warning.patient.npinumbernotpresent");
            }

            if (this.invalidFederalTaxId()) {
                return commonjs.showWarning("messages.warning.patient.federaltaxidnotpresent");
            }

            if (this.invalidBenefitOnDate()) {
                return commonjs.showWarning("messages.warning.patient.enterbenefitondate");
            }

            if (!app.insPokitdok && !app.insImagineSoftware) {
                return commonjs.showWarning("messages.warning.shared.missingEligibilityCheckConfiguration");
            }

            return true;
        },
        /* #endregion */

        /* #region Formatters and Converters */
        // --------------------------------------------------------------------------------
        //                             FORMATTERS & CONVERTERS
        // --------------------------------------------------------------------------------

        /**
         * Formats the insurance data from the BC eligibility check
         *
         * @param {object} data
         * @returns {object}
         */
        formatInsuranceDataBc: function (data) {
            var insurance_data = _.get(data, "results[0]") || _.get(data, "err[0]") || {};
            insurance_data.BIRTHDATE = (insurance_data.BIRTHDATE && commonjs.getFormattedDate(insurance_data.BIRTHDATE)) || "";
            insurance_data.DOS = (insurance_data.DOS && commonjs.getFormattedDate(insurance_data.DOS)) || "";

            return insurance_data;
        },

        /**
         * Formats the insurance data from the OHIP eligibility check
         *
         * @param {object} data
         * @returns {object}
         */
        formatInsuranceDataOhip: function (data) {
            var insurance_data = _.get(data, "results[0]") || _.get(data, "faults[0]") || data.err || {};
            insurance_data.dateOfBirth = (insurance_data.dateOfBirth && commonjs.getFormattedDate(insurance_data.dateOfBirth)) || "";
            insurance_data.expiryDate = (insurance_data.expiryDate && commonjs.getFormattedDate(insurance_data.expiryDate)) || "";

            return insurance_data;
        },
        /* #endregion */

        /* #region Setters */
        // --------------------------------------------------------------------------------
        //                                     SETTERS
        // --------------------------------------------------------------------------------

        /**
         * Sets the order data to the view
         *
         * @param {object} order_data
         */
        setOrderData: function (order_data) {
            this.data = order_data || {};
            this.data.manually_verified = this.data.manually_verified === "true" || this.data.manually_verified === true;
            this.data.mode = this.data.mode || "params";

            this.determineStateEnabledServiceTypes()
                .determineStateEnabledDate()
                .determineStateEnabledButton()
                .eligibilityDateVerified();

            return this;
        },

        /**
         * Hides or shows the Eligibility Date
         */
        eligibilityDateVerified: function () {
            // eligibility_dt
            var $div = $(".eligibility-date");

            if (this.key) {
                $div = $div.find("[data-key='" + this.key + "']");
            }

            if (!this.data.eligibility_dt) {
                $div.hide();
                return this;
            }

            var text = commonjs.geti18NString("order.insuranceEligibility.statusMessage") + " " + moment(this.data.eligibility_dt).format("L LT z");
            $div.find("span").text(text);
            $div.show();

            return this;
        },
        /* #endregion */

        /* #region Getters */
        // --------------------------------------------------------------------------------
        //                                     GETTERS
        // --------------------------------------------------------------------------------

        /**
         * Returns the date of service
         *
         * @returns {string}
         */
        dateOfService: function () {
            return moment(_.get(this, "data.studies[0].study_dt")).format("YYYY-MM-DD");
        },

        /**
         * Indicates if an eligibility has been run
         *
         * @returns {boolean}
         */
        eligibilityExists: function () {
            return ~~this.data.eligibility_id > 0;
        },

        /**
         * Returns data for the Imagine Software view
         *
         * @returns {object}
         */
        imagineSoftwareData: function () {
            return {
                insurance: {
                    id: this.data.patient_insurance_id,
                    coverage_level: this.coverage_level,
                    relation_id: this.data.insurance_relation,
                    providerName: this.data.insurance_name,
                    address1: this.data.insurance_address_1,
                    address2: this.data.insurance_address_2,
                    city: this.data.insurance_city,
                    state: this.data.insurance_state,
                    zip: this.data.insurance_zip,
                    policyNumber: this.data.policy_number,
                    subscriberFirstName: this.data.subscriber_firstname,
                    subscriberLastName: this.data.subscriber_lastname,
                    subscriberName: this.data.subscriber_name,
                    subscriberGender: this.data.subscriber_gender,
                    subscriberDob: this.subscriberDateOfBirth()
                },
                mode: this.data.mode,
                patient: {
                    id: this.data.patient_id,
                    name: this.data.patient_name,
                    firstName: this.data.patient_first_name,
                    middleName: this.data.patient_middle_name,
                    lastName: this.data.patient_last_name,
                    gender: this.data.patient_gender,
                    address1: this.data.patient_address_1,
                    address2: this.data.patient_address_2,
                    city: this.data.patient_city,
                    state: this.data.patient_state,
                    zip: this.data.patient_zip,
                    dob: this.patientDateOfBirth(),
                    mrn: this.data.patient_account_no,
                    homePhone: this.data.patient_home_phone,
                    mobilePhone: this.data.patient_mobile_phone,
                    email: this.data.patient_email
                },
                studies: this.data.studies || [],
                service_types: this.serviceTypes(),
                visit: {
                    procedures: this.visitProcedures(),
                    dateOfService: this.dateOfService(),
                    referringPhysician: this.referringPhysician(),
                    facility_id: this.data.facility_id,
                    referringPhysicianPhone: ""  // This is going to be replaced by an details icon popup
                }
            }
        },

        /**
         * Indicates if the order has an invalid benefit on date
         *
         * @returns {boolean}
         */
        invalidBenefitOnDate: function () {
            return (
                this.template_options.show_benefits_on_date &&
                !dtpStore.get("benefit", "YYYY-MM-DD")
            );
        },

        /**
         * Indicates if the order has an invalid eligibility check
         *
         * @returns {boolean}
         */
        invalidEligibilityCheck: function () {
            return (
                !this.data.insurance_code &&
                _.includes(["hcp", "wsib"], _.toLower(this.data.insurance_code))
            );
        },

        /**
         * Indicates if the eligibility check is disabled for this facility
         *
         * @returns {boolean}
         */
        invalidEligibilityDisabled: function () {
            return this.data.enable_insurance_eligibility && this.data.enable_insurance_eligibility === "false";
        },

        /**
         * Indicates if the order has an invalid federal tax id
         *
         * @returns {boolean}
         */
        invalidFederalTaxId: function () {
            return !this.data.federal_tax_id;
        },

        /**
         * Indicates if the order has an invalid health number
         *
         * @returns {boolean}
         */
        invalidHealthNumber: function () {
            return (
                !this.data.policy_number.length &&
                !this.data.insurance_code &&
                _.includes(["hcp", "wsib"], _.toLower(this.data.insurance_code))
            );
        },

        /**
         * Indicates if the order has an invalid BC insurance
         *
         * @returns {boolean}
         */
        invalidInsuranceBc: function () {
            return _.toLower(this.data.insurance_code) !== "msp";
        },

        /**
         * Indicates if the order has an invalid NPI
         *
         * @returns {boolean}
         */
        invalidNpi: function () {
            return !this.data.facility_npi_no;
        },

        /**
         * Indicates if the order has an invalid patient
         *
         * @returns {boolean}
         */
        invalidPatient: function () {
            return !this.data.patient_name;
        },

        /**
         * Indicates if the order has an invalid PHN
         *
         * @returns {boolean}
         */
        invalidPhn: function () {
            return !this.data.phn_alt_account_no;
        },

        /**
         * Indicates if the order has an invalid primary insurance
         *
         * @returns {boolean}
         */
        invalidPrimaryInsurance: function () {
            return !this.data.insurance_code || !this.data.insurance_name;
        },

        /**
         * Indicates if the order has an invalid service type
         *
         * @returns {boolean}
         */
        invalidServiceType: function () {
            return (
                this.template_options.show_service_type &&
                !$("#ddlServiceType" + this.key + " :selected").length
            );
        },

        /**
         * Indicates if there are selected studies
         *
         * @returns {boolean}
         */
        invalidStudies: function () {
            return _.isEmpty(this.data.studies);
        },

        /**
         * Returns the patient's birth date formatted for local time
         *
         * @returns {string}
         */
        patientDateOfBirth: function () {
            return this.data.patient_birth_date && moment(this.data.patient_birth_date).format("YYYY-MM-DD") || "";
        },

        /**
         * Indicates if user only has read-only permission
         *
         * @returns {boolean}
         */
        readOnly: function () {
            return (
                !app.checkPermissionCode("ELIG") &&
                app.checkPermissionCode("ELGR") &&
                app.default_country_alpha_3_code === "usa"
            )
        },

        /**
         * User has read-only eligibility access and no eligibility exists
         *
         * @returns {boolean}
         */
        readOnlyNoEligibility: function () {
            return this.readOnly() && !this.eligibilityExists();
        },

        /**
         * Returns the referring physician
         *
         * @returns {string}
         */
        referringPhysician: function () {
            return _.get(this, "data.studies[0].referring_physician_name", "");
        },

        /**
         * Returns a string of service type codes selected from the dropdown
         *
         * @returns {string}
         */
        serviceTypeCodes: function () {
            var val = $("#ddlServiceType" + this.key).val();

            return Array.isArray(val)
                ? val.join("~")
                : "";
        },

        /**
         * Returns service types
         *
         * @returns {string[]}
         */
        serviceTypes: function () {
            return app.insImagineSoftware
                ? this.serviceTypesImagineSoftware()
                : this.serviceTypesDropdown();
        },

        /**
         * Returns an array of strings of service type descriptions? selected from the dropdown
         *
         * @returns {string[]}
         */
         serviceTypesDropdown: function () {
            var arr_service_types = [];

            $("#ddlServiceType" + this.key + " :selected").each(function (index, el) {
                var service_type = $(el)
                    .attr("title")
                    .toLowerCase()
                    .replace(/[^A-Z0-9]+/ig, "_");

                arr_service_types.push(service_type);
            });

            return arr_service_types;
        },

        /**
         * Returns an array of strings of service type based on the modalities of all of the studies
         *
         * @returns {string[]}
         */
        serviceTypesImagineSoftware: function () {
            var arr_service_types = [];
            var add_4 = this.data.studies.some(function (study) {
                var modality = study.modality || study.modality_name || "";
                return !_.includes(["CT", "MR"], modality);
            });
            var add_62 = this.data.studies.some(function (study) {
                var modality = study.modality || study.modality_name || "";
                return _.includes(["CT", "MR"], modality);
            });

            if (add_4) {
                arr_service_types.push("4");
            }

            if (add_62) {
                arr_service_types.push("62");
            }

            return arr_service_types;
        },

        /**
         * Returns the subscriber's birth date formatted for local time
         *
         * @returns {string}
         */
        subscriberDateOfBirth: function () {
            return this.data.subscriber_dob && moment(this.data.subscriber_dob).format("YYYY-MM-DD") || "";
        },

        /**
         * Returns the subcriber name in uppercase.  Used for several modal headers.
         *
         * @returns {boolean}
         */
        subscriberNameHeader: function () {
            return _.toUpper(_.trim(this.data.subscriber_lastname) + ", " + _.trim(this.data.subscriber_firstname));
        },

        /**
         * Returns a list of all cpt codes from the study data
         *
         * @returns {string[]}
         */
        visitProcedures: function () {
            var cpt_codes = this.data.studies.map(function (study) {
                var cpt_details = study.cptDetails || [];

                return cpt_details.map(function (cpt) {
                    return {
                        code: cpt.code || "",
                        fee: ~~(cpt.global_fee || cpt.fee),
                        description: cpt.desc || cpt.description || ""
                    }
                });
            });

            return _.flatten(cpt_codes);
        }
        /* #endregion */
    });

    return insuranceEligibility;
});
