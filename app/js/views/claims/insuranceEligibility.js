define([
    "jquery",
    "underscore",
    "backbone",
    "views/claims/insuranceImagineSoftware",
    "text!templates/claims/insuranceEligibility.html",
    "text!templates/claims/insurancePokitdokpopup.html",
    "text!templates/claims/eligibilityResponseInfo.html",
    "text!templates/claims/eligibilityResponseOHIP.html",
    "text!templates/claims/eligibilityResponseBC.html",
    "text!templates/claims/eligibilityErrorTemplate.html"
],
function (
    $,
    _,
    Backbone,
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
         * Initializes global view variables on render
         *
         * @param {object}  args
         * @prop  {number}  args.order_id
         * @prop  {string}  args.coverage_level
         * @prop  {boolean} args.show_service_type
         * @prop  {boolean} args.show_benefits_on_date
         * @prop  {boolean} args.show_eligibility_status
         * @prop  {object}  args.parent
         * @prop  {object}  args.parent.view
         * @prop  {string}  args.parent.getter
         * @prop  {string}  args.parent.setter
         */
        initGlobalVariables: function (args) {
            this.order_id = ~~args.order_id;
            this.coverage_level = args.coverage_level || "";
            this.key = _.capitalize(this.coverage_level);
            this.parent = args.parent || {};

            this.template_options = {
                key: this.key,
                btnI18n: this.buttonI18n(),
                show_service_type: !!args.show_service_type,
                show_benefits_on_date: !!args.show_benefits_on_date,
                show_eligibility_status: !!args.show_eligibility_status,
                container_class: args.container_class || ""
            }

            return this;
        },

        /**
         * Changes Service Types HTML select box into a multi-select box
         */
        initializeServiceTypesDropdown: function () {
            var $ddlServiceType = $("#ddlServiceType" + this.key);

            $ddlServiceType.multiselect({
                enableFiltering: true,
                enableCaseInsensitiveFiltering: true,
                maxHeight: 200,
                nonSelectedText: i18n.get("shared.buttons.noneSelected"),
                numberDisplayed: 1,
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

            $ddlServiceType.multiselect("deselectAll", false);
            $ddlServiceType.multiselect("refresh");

            return this;
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

            var self = this;

            this.initGlobalVariables(args);
            this.fetchOrderData(function () {
                if (!self.rendered) {
                    if (args.show_service_type) {
                        self.fetchServiceTypes(function (service_types) {
                            self.renderTemplate(service_types);
                        });
                    }
                    else {
                        self.renderTemplate();
                    }
                }
            });

            return this;
        },

        /**
         * Renders the main eligibility template. This may consist of ...
         *   1. Service Types dropdown
         *   2. Benefits On Date
         *   3. Eligibility button
         *
         * @param {object[]} service_types
         */
        renderTemplate: function (service_types) {
            $(this.el).html(this.template({
                data: this.template_options,
                service_types: service_types || []
            }));

            this.rendered = true;

            if (!_.isEmpty(service_types)) {
                this.initializeServiceTypesDropdown();
            }

            this.initializeBenefitsOnDate();
            this.determineStateEnabledAllInputs();

            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);

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
                    eligibility_dt: this.benefitOnDate("YYYY-MM-DD"),
                    phn: this.data.phn_alt_account_no,
                    birth_date: this.data.patient_birth_date,
                    facility_id: this.data.facility_id || app.default_facility_id
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
                    BenefitOnDate: this.benefitOnDate("YYYY-MM-DD") || moment().format("YYYY-MM-DD"),
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
                    self.stateLoading(false);

                    return callback(response);
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

            // Imagine Software
            if (app.insImagineSoftware) {
                return $.ajax({
                    url: "/studiesListImagineSoftware",
                    type: "GET",
                    data: {
                        orderId: this.order_id,
                        coverageLevel: this.coverage_level
                    },
                    success: function (response) {
                        commonjs.hideLoading();

                        var data = _.get(response, 'result');
                        self.setOrderData(data);

                        return callback(data);
                    },
                    error: function (request) {
                        commonjs.handleXhrError(request);
                        return callback();
                    }
                });
            }

            // Pokitdok and Canada
            $.ajax({
                url: "/insuranceEligibilityOrder",
                type: "GET",
                data: {
                    order_id: this.order_id,
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

        /* #region Functionality */
        // --------------------------------------------------------------------------------
        //                                  FUNCTIONALITY
        // --------------------------------------------------------------------------------

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

                var errors = _.get(data, "responseJSON.sys.data.errors");

                if (!_.isEmpty(errors)) {
                    return self.openPokitdokError(errors.validation || {});
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
            if (!_.isEmpty(this.parent) && this.parent.view && this.parent.getter) {
                var set_data = this.parent.view[this.parent.getter](this.coverage_level);
                this.setOrderData(set_data);
            }

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

            $("#btnPrintInsuranceEligibility").off("click").click(function () {
                self.print(data.data);
            });

            return this;
        },

        /**
         * Opens the Pokitdok error modal
         *
         * @param {object} errors
         */
        openPokitdokError: function (errors) {
            var html = this.eligibilityErrorTemplateForm({ "error_obj": errors });

            commonjs.showDialog({
                header: this.subscriberNameHeader(),
                width: "75%",
                height: "70%",
                html: html
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

            $("#btnPrintInsuranceEligibility").off("click").click(function () {
                self.print(data);
            });

            return this;
        },

        /**
         * Print non-third party eligibility
         */
        print: function (data) {
            var win = window.open('');
            if (!win) { return; }

            var print_data = this.setEligibilityInfoForPrint(data);
            var print_info = this.insuranceUsaTemplate({ "eligibilityInfo": print_data });

            win.document.write(print_info);
            win.document.close();
            win.print();
            win.close();

            commonjs.hideLoading();
        },
        /* #endregion */

        /* #region DOM Manipulation */
        // --------------------------------------------------------------------------------
        //                                 DOM MANIPULATION
        // --------------------------------------------------------------------------------

        /**
         * Enables or disables all of the inputs
         */
        determineStateEnabledAllInputs: function () {
            this.determineStateEnabledServiceTypes()
                .determineStateEnabledDate()
                .determineStateEnabledButton();

            return this;
        },

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledButton: function () {
            var disabled = this.disableInputs();
            $("#btnEligibility" + this.key).prop("disabled", disabled);

            return this;
        },

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledDate: function () {
            var disabled = this.disableInputs();
            $("#txtBenefitOnDate" + this.key).prop("disabled", disabled);

            return this;
        },

        /**
         * Enables or disables the service types multi-select
         *
         * Disable if user has only read-only permission and no request has been made
         */
        determineStateEnabledServiceTypes: function () {
            var state = this.disableInputs()
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
         * Formats a date while avoiding empty and bad date formats which would return Invalid Date
         *
         * @param {string} date
         * @returns {string}
         */
        formatDate: function (date) {
            return date && moment(date).isValid()
                ? moment(date).format("YYYY-MM-DD")
                : "";
        },

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
         * Initializes the Benefits on Date to the current company date
         */
        initializeBenefitsOnDate: function () {
            var date = commonjs.getCompanyCurrentDateTime().format("L");
            $("#txtBenefitOnDate" + this.key).val(date);

            return this;
        },

        /**
         * Sets the order data to the view
         *
         * @param {object} order_data
         */
        setOrderData: function (order_data) {
            this.original_order_data = _.cloneDeep(order_data || {});
            this.data = _.cloneDeep(order_data || {});
            this.data.manually_verified = this.data.manually_verified === "true" || this.data.manually_verified === true;
            this.data.mode = this.data.mode || "params";

            this.eligibilityDateVerified(true, this.data.request_dt || this.data.eligibility_dt);

            return this;
        },

        /**
         * Hides or shows the Eligibility Date
         * This is also called from the insuanceImagineSoftware view
         *
         * @param {string} request_dt
         */
        eligibilityDateVerified: function (is_eligible, request_dt) {
            var $div = $(".eligibility-date");

            if (this.key) {
                $div = $(".eligibility-date[data-key='" + this.key + "']");
            }

            if (!request_dt) {
                $div.hide();
                return this;
            }

            // Status Icon
            var $icon = $div.find("i");
            $icon
                .removeClass("fa-check-circle")
                .removeClass("fa-times-circle")
                .removeClass("menu-icon-green")
                .removeClass("menu-icon-red");

            if (is_eligible) {
                $icon
                    .addClass("fa-check-circle")
                    .addClass("menu-icon-green");
            }
            else {
                $icon
                    .addClass("fa-times-circle")
                    .addClass("menu-icon-red");
            }

            // Status Text
            var i18n = is_eligible
                ? "order.insuranceEligibility.statusMessage"
                : "order.insuranceEligibility.notVerifiedMessage";
            var text = commonjs.geti18NString(i18n) + " " + moment(request_dt).format("L LT z");
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
         * Returns the Benefit On Date
         *
         * @param {string} format
         * @returns {string}
         */
        benefitOnDate: function (format) {
            var date = $("#txtBenefitOnDate" + this.key).val();

            if (!date) {
                return "";
            }

            return format
                ? moment(date).format(format)
                : date;
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
         * No idea what this does. Used for Pokitdok print.
         */
        chkVar: function (p0, p1, p2, p3, p4, p5, p6) {
            if (p6 !== undefined) return (p0 && p0[p1] && p0[p1][p2] && p0[p1][p2][p3] && p0[p1][p2][p3][p4] && p0[p1][p2][p3][p4][p5] && p0[p1][p2][p3][p4][p5][p6] ? true : false);
            else if (p5 !== undefined) return (p0 && p0[p1] && p0[p1][p2] && p0[p1][p2][p3] && p0[p1][p2][p3][p4] && p0[p1][p2][p3][p4][p5] ? true : false);
            else if (p4 !== undefined) return (p0 && p0[p1] && p0[p1][p2] && p0[p1][p2][p3] && p0[p1][p2][p3][p4] ? true : false);
            else if (p3 !== undefined) return (p0 && p0[p1] && p0[p1][p2] && p0[p1][p2][p3] ? true : false);
            else if (p2 !== undefined) return (p0 && p0[p1] && p0[p1][p2] ? true : false);
            else if (p1 !== undefined) return (p0 && p0[p1] ? true : false);
            else if (p0 !== undefined) return (p0 ? true : false);
            else return false;
        },

        /**
         * Returns the date of service
         *
         * @returns {string}
         */
        dateOfService: function () {
            return this.formatDate(_.get(this, "data.studies[0].study_dt"));
        },

        /**
         * User has read-only eligibility access and no eligibility exists or
         * there is an order id but no data which happens when there is no insurance assigned to the order
         *
         * @returns {boolean}
         */
        disableInputs: function () {
            return (
                (this.readOnly() && !this.eligibilityExists()) ||
                (this.order_id > 0 && _.isEmpty(this.original_order_data))
            );
        },

        /**
         * Indicates if an eligibility has been run
         *
         * @returns {boolean}
         */
        eligibilityExists: function () {
            return ~~_.get(this, "data.eligibility_id", 0) > 0;
        },

        /**
         * Returns the Imagine Software external provider id of the facility id
         *
         * @returns {number}
         */
        externalProviderId: function () {
            return ~~_.get(commonjs.getFacilityById(this.data.facility_id), "external_provider_id");
        },

        /**
         * Returns data for the Imagine Software view
         *
         * @returns {object}
         */
        imagineSoftwareData: function () {
            return {
                eligibility_view: this,
                eligibility_id: ~~this.data.eligibility_id,
                estimation_id: ~~this.data.estimation_id,
                insurance: {
                    id: this.data.patient_insurance_id,
                    code: this.data.insurance_code,
                    coverageLevel: this.coverage_level,
                    relationId: this.data.relation_id,
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
                    subscriberDob: this.subscriberDateOfBirth(),
                    tradingPartnerId: this.data.trading_partner_id
                },
                mode: this.data.mode,
                original_order_data: _.cloneDeep(this.original_order_data),
                parent: this.parent,
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
                    facilityId: this.data.facility_id,
                    externalProviderId: this.externalProviderId()
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
                !this.benefitOnDate()
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
            return this.formatDate(this.data.patient_birth_date);
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
                app.country_alpha_3_code === "usa"
            )
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
            // Per EXA-41866, we need to always send service type 45
            var arr_service_types = [45];
            var add_4 = this.data.studies.some(function (study) {
                var modality = study.modality || study.modality_name || study.modality_code || "";
                return !_.includes(["CT", "MR"], modality);
            });
            var add_62 = this.data.studies.some(function (study) {
                var modality = study.modality || study.modality_name || study.modality_code || "";
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
         * Hydrates Pokitdok print data
         *
         * @param {object} InsuranceData
         * @returns {object}
         */
        setEligibilityInfoForPrint: function (InsuranceData) {
            var self = this;
            var eligibilityInfo = {};
            eligibilityInfo.subscriberInfo = {};
            eligibilityInfo.subscriberInfo.subscriberFirstName = self.chkVar(InsuranceData, 'subscriber', 'first_name') ? InsuranceData && InsuranceData.subscriber && InsuranceData.subscriber.first_name : '-';
            eligibilityInfo.subscriberInfo.subscriberLastName = self.chkVar(InsuranceData, 'subscriber', 'last_name') ? InsuranceData.subscriber.last_name : '-';
            eligibilityInfo.subscriberInfo.subscriberID = self.chkVar(InsuranceData, 'subscriber', 'id') ? InsuranceData.subscriber.id : '-';
            eligibilityInfo.subscriberInfo.birthDate = self.chkVar(InsuranceData, 'subscriber', 'birth_date') ? InsuranceData.subscriber.birth_date : '-';
            eligibilityInfo.subscriberInfo.gender = self.chkVar(InsuranceData, 'coverage') ? (InsuranceData.coverage.active !== undefined && InsuranceData.coverage.active ? 'Yes' : 'No') : '-';
            eligibilityInfo.subscriberInfo.isActive = self.chkVar(InsuranceData, 'coverage') ? (InsuranceData.coverage.active !== undefined && InsuranceData.coverage.active ? 'Yes' : 'No') : '-';

            eligibilityInfo.moreInfo = {};
            eligibilityInfo.moreInfo.coverage = self.chkVar(InsuranceData, 'coverage') ? (InsuranceData.coverage.active !== undefined && InsuranceData.coverage.active ? 'Yes' : 'No') : '-';
            eligibilityInfo.moreInfo.coverageLevel = self.chkVar(InsuranceData, 'coverage', 'plan_benefit_description', 'coverage_level') ? InsuranceData.coverage.plan_benefit_description.coverage_level : '-';
            eligibilityInfo.moreInfo.insuaranceType = self.chkVar(InsuranceData, 'coverage', 'coverage_details', 'insurance_type') ? InsuranceData.coverage.coverage_details.insurance_type : '-';
            eligibilityInfo.moreInfo.groupDescription = self.chkVar(InsuranceData, 'coverage', 'coverage_details', 'plan_description') ? InsuranceData.coverage.coverage_details.plan_description : '-';
            eligibilityInfo.moreInfo.groupNumber = self.chkVar(InsuranceData, 'coverage', 'coverage_details', 'group_or_policy_number') ? InsuranceData.coverage.coverage_details.group_or_policy_number : '-';
            eligibilityInfo.moreInfo.planBeginDate = self.chkVar(InsuranceData, 'coverage', 'plan_begin_date') ? InsuranceData.coverage.plan_begin_date : '-';
            eligibilityInfo.moreInfo.planEndDate = self.chkVar(InsuranceData, 'coverage', 'plan_end_date') ? InsuranceData.coverage.plan_end_date : '-';
            eligibilityInfo.moreInfo.planDescription = self.chkVar(InsuranceData, 'coverage', 'plan_description') ? InsuranceData.coverage.plan_description : '-';
            eligibilityInfo.moreInfo.planNumber = self.chkVar(InsuranceData, 'coverage', 'plan_number') ? InsuranceData.coverage.plan_number : '-';
            eligibilityInfo.moreInfo.serviceDate = self.chkVar(InsuranceData, 'coverage', 'service_date') ? InsuranceData.coverage.service_date : '-';

            var coverageDataMessages = (self.chkVar(InsuranceData, 'coverage', 'messages') ? InsuranceData.coverage.messages : []).concat(self.chkVar(InsuranceData, 'coverage', 'coverage_details', 'messages') ? InsuranceData.coverage.coverage_details.messages : []);
            coverageDataMessages = coverageDataMessages.concat(self.chkVar(InsuranceData, 'coverage', 'plan_benefit_description', 'messages') ? InsuranceData.coverage.plan_benefit_description.messages : []);

            eligibilityInfo.messages = {};
            if (coverageDataMessages) {
                eligibilityInfo.messages = coverageDataMessages ? coverageDataMessages : '-';
            }

            eligibilityInfo.deductiblesData = {};
            var deductiblesData = [];
            deductiblesData = self.chkVar(InsuranceData, 'coverage', 'deductibles');
            if (deductiblesData && InsuranceData.coverage.deductibles.length > 0) {
                eligibilityInfo.deductiblesData = InsuranceData.coverage.deductibles;
            }

            eligibilityInfo.out_of_pocketData = {};
            if (self.chkVar(InsuranceData, 'coverage', 'out_of_pocket') && InsuranceData.coverage.out_of_pocket.length > 0) {
                eligibilityInfo.out_of_pocketData = InsuranceData.coverage.out_of_pocket;
            }

            eligibilityInfo.summaryDeductable = {};
            eligibilityInfo.summaryDeductable.inNetwork = {};

            eligibilityInfo.summaryDeductable.inNetwork.totalDeductable = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'limit', 'currency') && InsuranceData.summary.deductible.individual.in_network.limit.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'limit', 'amount') ? InsuranceData.summary.deductible.individual.in_network.limit.amount : '-');
            eligibilityInfo.summaryDeductable.inNetwork.spentYTD = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'applied', 'currency') && InsuranceData.summary.deductible.individual.in_network.applied.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'applied', 'amount') ? InsuranceData.summary.deductible.individual.in_network.applied.amount : '-');
            eligibilityInfo.summaryDeductable.inNetwork.remaining = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'remaining', 'currency') && InsuranceData.summary.deductible.individual.in_network.remaining.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'in_network', 'remaining', 'amount') ? InsuranceData.summary.deductible.individual.in_network.remaining.amount : '-');

            eligibilityInfo.summaryDeductable.inNetwork.totalDeductable1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'limit', 'currency') && InsuranceData.summary.out_of_pocket.individual.in_network.limit.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'limit', 'amount') ? InsuranceData.summary.out_of_pocket.individual.in_network.limit.amount : '-');
            eligibilityInfo.summaryDeductable.inNetwork.spentYTD1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'applied', 'currency') && InsuranceData.summary.out_of_pocket.individual.in_network.applied.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'applied', 'amount') ? InsuranceData.summary.out_of_pocket.individual.in_network.applied.amount : '-');
            eligibilityInfo.summaryDeductable.inNetwork.remaining1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'remaining', 'currency') && InsuranceData.summary.out_of_pocket.individual.in_network.remaining.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'in_network', 'remaining', 'amount') ? InsuranceData.summary.out_of_pocket.individual.in_network.remaining.amount : '-');

            eligibilityInfo.summaryDeductable.outOfNetwork = {};
            eligibilityInfo.summaryDeductable.outOfNetwork.totalDeductable = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'limit', 'currency') && InsuranceData.summary.deductible.individual.out_of_network.limit.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'limit', 'amount') ? InsuranceData.summary.deductible.individual.out_of_network.limit.amount : '-');
            eligibilityInfo.summaryDeductable.outOfNetwork.spentYTD = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'applied', 'currency') && InsuranceData.summary.deductible.individual.out_of_network.applied.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'applied', 'amount') ? InsuranceData.summary.deductible.individual.out_of_network.applied.amount : '-');
            eligibilityInfo.summaryDeductable.outOfNetwork.remaining = ((self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'remaining', 'currency') && InsuranceData.summary.deductible.individual.out_of_network.remaining.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'deductible', 'individual', 'out_of_network', 'remaining', 'amount') ? InsuranceData.summary.deductible.individual.out_of_network.remaining.amount : '-');

            eligibilityInfo.summaryDeductable.outOfNetwork.totalDeductable1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'limit', 'currency') && InsuranceData.summary.out_of_pocket.individual.out_of_network.limit.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'limit', 'amount') ? InsuranceData.summary.out_of_pocket.individual.out_of_network.limit.amount : '-');
            eligibilityInfo.summaryDeductable.outOfNetwork.spentYTD1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'applied', 'currency') && InsuranceData.summary.out_of_pocket.individual.out_of_network.applied.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'applied', 'amount') ? InsuranceData.summary.out_of_pocket.individual.out_of_network.applied.amount : '-');
            eligibilityInfo.summaryDeductable.outOfNetwork.remaining1 = ((self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'remaining', 'currency') && InsuranceData.summary.out_of_pocket.individual.out_of_network.remaining.currency == 'USD' ? '$' : '')) + (self.chkVar(InsuranceData, 'summary', 'out_of_pocket', 'individual', 'out_of_network', 'remaining', 'amount') ? InsuranceData.summary.out_of_pocket.individual.out_of_network.remaining.amount : '-');

            eligibilityInfo.coInsuranceData = [];
            if (self.chkVar(InsuranceData, 'coverage', 'coinsurance') && InsuranceData.coverage.coinsurance.length > 0 && self.chkVar(InsuranceData, 'service_type_codes') && InsuranceData.service_type_codes.length > 0) {
                for (var k = 0; k < InsuranceData.service_type_codes.length; k++) {
                    for (var j = 0; j < InsuranceData.coverage.coinsurance.length; j++) {
                        var idx = _.indexOf(InsuranceData.coverage.coinsurance[j].service_type_codes, InsuranceData.service_type_codes[k]);

                        if (idx !== -1) {
                            eligibilityInfo.coInsuranceData.push({
                                "benefit_percent": InsuranceData.coverage.coinsurance[j].benefit_percent !== undefined ? InsuranceData.coverage.coinsurance[j].benefit_percent + '%' : '-',
                                "in_plan_network": InsuranceData.coverage.coinsurance[j].in_plan_network !== undefined ? InsuranceData.coverage.coinsurance[j].in_plan_network : '-',
                                "coverage_level": InsuranceData.coverage.coinsurance[j].coverage_level !== undefined ? InsuranceData.coverage.coinsurance[j].coverage_level : '-',
                                "authorization_required": InsuranceData.coverage.coinsurance[j].authorization_required !== undefined ? InsuranceData.coverage.coinsurance[j].authorization_required : '-',
                                "service_types": InsuranceData.coverage.coinsurance[j].service_types !== undefined ? InsuranceData.coverage.coinsurance[j].service_types[idx] : '-'
                            });
                        }
                    }
                }
            }

            eligibilityInfo.copayData = [];
            if (self.chkVar(InsuranceData, 'coverage', 'copay') && InsuranceData.coverage.copay.length > 0 && self.chkVar(InsuranceData, 'service_type_codes') && InsuranceData.service_type_codes.length > 0) {
                for (var k = 0; k < InsuranceData.service_type_codes.length; k++) {
                    for (var j = 0; j < InsuranceData.coverage.copay.length; j++) {
                        var idx = _.indexOf(InsuranceData.coverage.copay[j].service_type_codes, InsuranceData.service_type_codes[k]);

                        if (idx !== -1) {
                            eligibilityInfo.copayData.push({
                                "amount": (InsuranceData.coverage.copay[j].copayment !== undefined && InsuranceData.coverage.copay[j].copayment.currency !== undefined ? (InsuranceData.coverage.copay[j].copayment.currency === 'USD' ? '$' : '') : '') + (InsuranceData.coverage.copay[j].copayment !== undefined && InsuranceData.coverage.copay[j].copayment.amount !== undefined ? InsuranceData.coverage.copay[j].copayment.amount : '-'),
                                "in_plan_network": InsuranceData.coverage.copay[j].in_plan_network !== undefined ? InsuranceData.coverage.copay[j].in_plan_network : '-',
                                "coverage_level": InsuranceData.coverage.copay[j].coverage_level !== undefined ? InsuranceData.coverage.copay[j].coverage_level : '-',
                                "insurance_type": InsuranceData.coverage.copay[j].insurance_type !== undefined ? InsuranceData.coverage.copay[j].insurance_type : '-',
                                "plan_description": InsuranceData.coverage.copay[j].plan_description !== undefined ? InsuranceData.coverage.copay[j].plan_description : '-',
                                "service_types": InsuranceData.coverage.copay[j].service_types !== undefined ? InsuranceData.coverage.copay[j].service_types[idx] : '-',
                                "authorization_required": InsuranceData.coverage.copay[j].authorization_required !== undefined ? (InsuranceData.coverage.copay[j].authorization_required ? 'Yes' : 'No') : '-'
                            });
                        }
                    }
                }
            }

            eligibilityInfo.requestDetails = {};
            eligibilityInfo.requestDetails.subscriberId = self.chkVar(InsuranceData, 'subscriber', 'id') ? InsuranceData.subscriber.id : '-';
            eligibilityInfo.requestDetails.first_name = self.chkVar(InsuranceData, 'subscriber', 'first_name') ? InsuranceData && InsuranceData.subscriber && InsuranceData.subscriber.first_name : '-';
            eligibilityInfo.requestDetails.last_name = self.chkVar(InsuranceData, 'subscriber', 'last_name') ? InsuranceData.subscriber.last_name : '-';
            eligibilityInfo.requestDetails.birth_date = self.chkVar(InsuranceData, 'subscriber', 'birth_date') ? InsuranceData.subscriber.birth_date : '-';
            eligibilityInfo.requestDetails.gender = self.chkVar(InsuranceData, 'subscriber', 'gender') ? InsuranceData.subscriber.gender : '-';
            eligibilityInfo.requestDetails.address_lines = self.chkVar(InsuranceData, 'subscriber', 'address', 'address_lines') ? InsuranceData.subscriber.address.address_lines.toString() : '-';
            eligibilityInfo.requestDetails.city = self.chkVar(InsuranceData, 'subscriber', 'address', 'city') ? InsuranceData.subscriber.address.city : '-';
            eligibilityInfo.requestDetails.state = self.chkVar(InsuranceData, 'subscriber', 'address', 'state') ? InsuranceData.subscriber.address.state : '';
            eligibilityInfo.requestDetails.zipcode = self.chkVar(InsuranceData, 'subscriber', 'address', 'zipcode') ? InsuranceData.subscriber.address.zipcode : '-';
            eligibilityInfo.requestDetails.valid_request = self.chkVar(InsuranceData) ? (InsuranceData.valid_request !== undefined ? InsuranceData.valid_request : '-') : '-';
            eligibilityInfo.requestDetails.service_type_codes = self.chkVar(InsuranceData, 'service_type_codes') ? InsuranceData.service_type_codes.toString() : '-';
            eligibilityInfo.requestDetails.trace_number = self.chkVar(InsuranceData, 'trace_number') ? InsuranceData.trace_number : '-';
            eligibilityInfo.requestDetails.originating_company_id = self.chkVar(InsuranceData, 'originating_company_id') ? InsuranceData.originating_company_id : '-';

            eligibilityInfo.payerInfo = {};
            eligibilityInfo.payerInfo.payerId = self.chkVar(InsuranceData, 'payer', 'id') ? InsuranceData.payer.id : '-';
            eligibilityInfo.payerInfo.payerName = self.chkVar(InsuranceData, 'payer', 'name') ? InsuranceData.payer.name : '-';

            eligibilityInfo.providerInfo = {};
            eligibilityInfo.providerInfo.npi = self.chkVar(InsuranceData, 'provider', 'npi') ? InsuranceData.provider.npi : '-';
            eligibilityInfo.providerInfo.organization_name = self.chkVar(InsuranceData, 'provider', 'organization_name') ? InsuranceData.provider.organization_name : '-';

            eligibilityInfo.pharmacyInfo = {};
            eligibilityInfo.pharmacyInfo.is_eligible = self.chkVar(InsuranceData, 'pharmacy') ? (InsuranceData.pharmacy.is_eligible !== undefined && InsuranceData.pharmacy.is_eligible ? 'Yes' : 'No') : '-';

            eligibilityInfo.pharmacyData = [];
            if (self.chkVar(InsuranceData, 'pharmacy', 'copay') && InsuranceData.pharmacy.copay.length > 0) {
                for (var j = 0; j < InsuranceData.pharmacy.copay.length; j++) {
                    eligibilityInfo.pharmacyData.push({
                        "copayment": (InsuranceData.pharmacy.copay[j].copayment !== undefined && InsuranceData.pharmacy.copay[j].copayment.currency !== undefined ? (InsuranceData.pharmacy.copay[j].copayment.currency === 'USD' ? '$' : '') : '') + (InsuranceData.pharmacy.copay[j].copayment !== undefined && InsuranceData.pharmacy.copay[j].copayment.amount !== undefined ? InsuranceData.pharmacy.copay[j].copayment.amount : '-'),
                        "type": InsuranceData.pharmacy.copay[j].type !== undefined ? InsuranceData.pharmacy.copay[j].type : '-',
                        "notes": InsuranceData.pharmacy.copay[j].notes !== undefined ? InsuranceData.pharmacy.copay[j].notes : '-'
                    })
                }
            }

            eligibilityInfo.limitationsData = [];
            if (self.chkVar(InsuranceData, 'coverage', 'limitations') && InsuranceData.coverage.limitations.length > 0 && self.chkVar(InsuranceData, 'service_type_codes') && InsuranceData.service_type_codes.length > 0) {
                for (var k = 0; k < InsuranceData.service_type_codes.length; k++) {
                    for (var j = 0; j < InsuranceData.coverage.limitations.length; j++) {
                        var idx = _.indexOf(InsuranceData.coverage.limitations[j].service_type_codes, InsuranceData.service_type_codes[k]);

                        if (idx !== -1) {
                            eligibilityInfo.limitationsData.push({
                                "benefit_amount": (InsuranceData.coverage.limitations[j].benefit_amount !== undefined && InsuranceData.coverage.limitations[j].benefit_amount.currency !== undefined ? (InsuranceData.coverage.limitations[j].benefit_amount.currency === 'USD' ? '$' : '') : '') + (InsuranceData.coverage.limitations[j].benefit_amount !== undefined && InsuranceData.coverage.limitations[j].benefit_amount.amount !== undefined ? InsuranceData.coverage.limitations[j].benefit_amount.amount : '-'),
                                "description": InsuranceData.coverage.limitations[j].description !== undefined ? InsuranceData.coverage.limitations[j].description : '-',
                                "service_types": InsuranceData.coverage.limitations[j].service_types !== undefined ? InsuranceData.coverage.limitations[j].service_types[idx] : '-'
                            })
                        }
                    }
                }
            }

            eligibilityInfo.diclaimerData = [];
            if (self.chkVar(InsuranceData, 'coverage', 'disclaimer', 'messages') && InsuranceData.coverage.disclaimer.messages.length > 0) {
                eligibilityInfo.diclaimerData = InsuranceData.coverage.disclaimer.messages;
            }
            return eligibilityInfo;
        },

        /**
         * Returns the subscriber's birth date formatted for local time
         *
         * @returns {string}
         */
        subscriberDateOfBirth: function () {
            return this.formatDate(this.data.subscriber_dob);
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
