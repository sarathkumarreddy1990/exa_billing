define([
    "jquery",
    "underscore",
    "backbone",
    "sweetalert2",
    "text!templates/icon_and_name.html",
    "text!templates/providerAlert.html",
    "text!templates/claims/insuranceImagineSoftware.html",
    "text!templates/claims/insuranceImagineSoftwarePrint.html",
    "text!templates/claims/insuranceImagineSoftwareEligibilityItem.html",
    "text!templates/claims/insuranceImagineSoftwareLetterPrint.html",
    "text!templates/claims/insuranceImagineSoftwareLetter.html",
    'shared/report-utils',
],
function (
    $,
    _,
    Backbone,
    swal2,
    IconNameTemplate,
    ProviderAlertTemplate,
    ImagineSoftwareTemplate,
    ImagineSoftwarePrintTemplate,
    EligibilityItemTemplate,
    imagineSoftwareLetterPrintTemplate,
    imagineSoftwareLetterTemplate,
    goodFaithEstimateLetterUI

) {
    var insuranceImagineSoftware = Backbone.View.extend({
        el: null,
        rendered: false,
        displayedStaleWarning: false,
        template: _.template(ImagineSoftwareTemplate),
        printTemplate: _.template(ImagineSoftwarePrintTemplate),
        eligibilityItemTemplate: _.template(EligibilityItemTemplate),
        iconNameTemplate: _.template(IconNameTemplate),
        providerAlertTemplate:  _.template(ProviderAlertTemplate),
        printLetterTemplate: _.template(imagineSoftwareLetterPrintTemplate),
        letterTemplate: _.template(imagineSoftwareLetterTemplate),
        data: {},

        /* #region Event Handlers */
        // --------------------------------------------------------------------------------
        //                                 EVENT HANDLERS
        // --------------------------------------------------------------------------------

        events: {
            "click #divImagineSoftwarePage": "handleClickPage",
            "click #btnToggleHeader": "handleClickToggleHeader",
            "click #btnReestimate": "handleClickReestimate",
            "click #btnReestimateWarning": "handleClickReestimate",
            "click #btnRecheckEligibility": "handleClickRecheckEligibility",
            "click #btnEstimationLetter": "handleClickLetter",
            "click #btnPrintEligibility": "handleClickPrint",
            "click #btnUpdateSelected": "handleClickUpdateSelected",
            "click .clickImagineEligibility": "handleClickTabEligibility",
            "click .clickImagineEstimation": "handleClickTabEstimation",
            "click #btnGoodFaithLetter": "handleClickGoodFaithLetter",
        },

        /**
         * Close any open Physician popovers when you click outside of one
         */
        handleClickPage: function (e) {
            var class_this = $(e.target).attr("class");

            if (class_this && !_.includes(class_this, "pop-dont-hide")) {
                $(".popover").hide();
            }
        },

        handleClickLetter: function () {
            this.openLetter();
        },

        handleClickPrint: function () {
            this.print();
        },

        handleClickReestimate: function () {
            this.reestimate(this.handleEstimationData.bind(this));
        },

        handleClickRecheckEligibility: function () {
            this.recheckEligibility(this.handleEligibilityData.bind(this));
        },

        handleClickTabEligibility: function () {
            this.activateEligibility();
        },

        handleClickTabEstimation: function () {
            this.activateEstimation();
        },

        handleClickToggleHeader: function () {
            this.toggleHeader();
        },

        handleClickUpdateSelected: function () {
            this.updateSelected();
        },

        handleClickGoodFaithLetter: function () {
            this.createGoodFaithEstimateLetter();
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
            this.options = options || {};
        },

        /**
         * Entry point for this view
         *
         * @param {object} order_data
         */
        render: function (order_data) {
            var self = this;
            this.data = order_data || {};

            if (!this.rendered) {
                $(this.el).html(this.template());

                this.writeModalHeader()
                    .writeStudyIdSelection()
                    .removePrintButton()
                    .removeRecheckButtons()
                    .visibleStateEstimationTab()
                    .updateCulture();

                $("#modalBodyNested").css("padding", 0);

                this.rendered = true;
            }

            this.fetchEligibility(function (eligibility_data) {
                self.data.eligibility = eligibility_data || {};
                self.data.estimation = {};

                self.hydrateData()
                    .writeFormValues()
                    .updateEligibilityStatus()
                    .activateEligibility()
                    .updateCulture()
                    .setParentData("eligibility", eligibility_data);
            });

            return this;
        },
        /* #endregion */

        /* #region Load Data */
        // --------------------------------------------------------------------------------
        //                                    LOAD DATA
        // --------------------------------------------------------------------------------

        /**
         * Fetches eligibility data
         *
         * @param {function} callback
         */
        fetchEligibility: function (callback) {
            if (this.isMode("P")) {
                var existing_data = this.existingEligibilityData();

                return existing_data && !_.isEmpty(existing_data.eligibility)
                    ? callback(existing_data.eligibility)
                    : this.fetchEligibilityParams(callback);
            }

            if (this.isMode("S")) {
                return this.fetchEligibilityStudies(callback);
            }

            return callback(null);
        },

        /**
         * Fetches eligibility data using raw parameters
         *
         * @param {function} callback
         */
        fetchEligibilityParams: function (callback) {
            callback = commonjs.ensureCallback(callback);

            this.showLoading("eligibility");

            $.ajax({
                url: "/imagineSoftware/eligibilityForParams",
                type: "POST",
                data: this.paramsData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.hideLoading();
                    return callback(err);
                }
            });
        },

        /**
         * Fetches eligibility data using study ids
         *
         * @param {function} callback
         */
        fetchEligibilityStudies: function (callback) {
            callback = commonjs.ensureCallback(callback);

            this.showLoading("eligibility");

            $.ajax({
                url: "/imagineSoftware/eligibilityForStudies",
                type: "POST",
                data: this.studiesData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.hideLoading();
                    return callback(err);
                }
            });
        },

        /**
         * Fetches estimation data
         *
         * @param {function} callback
         */
        fetchEstimation: function (callback) {
            if (this.isMode("P")) {
                var existing_data = this.existingEligibilityData();

                this.createNewParentEligibilityData();

                return existing_data && !_.isEmpty(existing_data.estimation)
                    ? callback(existing_data.estimation)
                    : this.fetchEstimationParams(callback);
            }

            if (this.isMode("S")) {
                return this.fetchEstimationStudies(callback);
            }

            return callback(null);
        },

        /**
         * Fetches estimation data using raw parameters
         *
         * @param {function} callback
         */
        fetchEstimationParams: function (callback) {
            callback = commonjs.ensureCallback(callback);

            this.showLoading("estimation");

            $.ajax({
                url: "/imagineSoftware/estimationForParams",
                type: "POST",
                data: this.paramsData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.hideLoading();
                    return callback(err);
                }
            });
        },

        /**
         * Fetches estimation data using study ids
         *
         * @param {function} callback
         */
        fetchEstimationStudies: function (callback) {
            callback = commonjs.ensureCallback(callback);

            this.showLoading("estimation");

            $.ajax({
                url: "/imagineSoftware/estimationForStudies",
                type: "POST",
                data: this.studiesData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.hideLoading();
                    return callback(err);
                }
            });
        },

        /**
         * Recheck eligibility
         *
         * @param {function} callback
         */
        recheckEligibility: function (callback) {
            callback = commonjs.ensureCallback(callback);

            var self = this;

            this.showLoading("eligibility");

            $.ajax({
                url: "/imagineSoftware/recheckEligibility",
                type: "POST",
                data: {
                    studyIds: this.selectedStudyIds(),
                    patientInsuranceId: this.data.insurance.id,
                    serviceType: this.serviceTypes()
                },
                success: function (data) {
                    commonjs.hideLoading();
                    // Rechecking eligibility invalidates the existing estimation
                    self.data.estimation = {};
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback(err);
                }
            });

            return this;
        },

        /**
         * Re-estimate
         *
         * @param {function} callback
         */
        reestimate: function (callback) {
            callback = commonjs.ensureCallback(callback);

            var self = this;

            this.showLoading("estimation");

            $.ajax({
                url: "/imagineSoftware/recheckEstimation",
                type: "POST",
                data: {
                    studyIds: this.selectedStudyIds(),
                    patientInsuranceId: this.data.insurance.id,
                    serviceType: this.serviceTypes()
                },
                success: function (data) {
                    commonjs.hideLoading();
                    // Re-estimating invalidates the existing eligibility
                    self.data.eligibility = {};
                    self.activateEstimation();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.hideLoading();
                    return callback(err);
                }
            });

            return this;
        },
        /* #endregion */

        /* #region Functionality */
        // --------------------------------------------------------------------------------
        //                                  FUNCTIONALITY
        // --------------------------------------------------------------------------------

        /**
         * Delivers an alert warning the user of a stale estimation
         */
        alertStaleEstimation: function () {
            this.displayedStaleWarning = true;

            swal2.fire({
                type: "warning",
                title: i18n.get("patient.patientInsurance.eligibility.staleEstimationWarning"),
                html:  i18n.get("patient.patientInsurance.eligibility.staleEstimationWarningBody"),
                onOpen: function () {
                    // in billing display css is globally applied to label tag
                    $('.swal2-checkbox').addClass('dispaly-none-important');
                }
            });

            return this;
        },

        /**
         * Fetches estimation data and writes the form values
         *
         * @param {function} callback
         */
        loadEstimation: function (callback) {
            callback = commonjs.ensureCallback(callback);

            if (this.data.eligibility.isStale && !this.displayedStaleWarning) {
                this.alertStaleEstimation();
            }

            if (this.needEstimationData()) {
                var self = this;

                this.fetchEstimation(function (estimation_data) {
                    self.handleEstimationData(estimation_data);
                    self.activateEstimation();

                    callback();
                });
            }
            else {
                callback();
            }
        },

        /**
         * Fetches eligibility data and writes the form values
         *
         * @param {function} callback
         */
        loadEligibility: function (callback) {
            callback = commonjs.ensureCallback(callback);

            if (this.needEligibilityData()) {
                var self = this;

                this.fetchEligibility(function (eligibility_data) {
                    self.handleEligibilityData(eligibility_data);
                    self.activateEligibility();

                    callback();
                });
            }
            else {
                callback();
            }
        },

        /**
         * Handles propogation and storage of estimation data after it has been received
         *
         * @param {Object} estimationData
         */
        handleEstimationData: function (estimationData) {
            this.data.estimation = estimationData || {};

            this.scrollToTopOfEstimation()
                .hydrateDataEstimation()
                .writeFormValuesEstimation()
                .setParentData("estimation", estimationData);
        },

        /**
         * Handles propogation and storage of eligibility data after it has been received
         *
         * @param {Object} eligibilityData
         */
        handleEligibilityData: function (eligibilityData) {
            this.data.eligibility = eligibilityData || {};

            this.hydrateData()
                .writeFormValues()
                .updateEligibilityStatus()
                .updateCulture()
                .setParentData("eligibility", eligibilityData);

            return this;
        },

        /**
         * Print Estimation Letter
         */
        printLetter: function () {
            var raw_html = this.printLetterTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);
            var win = window.open();

            win.document.open();
            win.document.write(translated_html);
            win.document.close();
            win.print();
            win.close();

            return this;
        },

        /**
         * Create good faith estimation letter in pdf format
         *
         * @returns
         */
         createGoodFaithEstimateLetter: function () {
            goodFaithEstimateLetterUI.showReport({
                id: "goodFaithEstimateLetter",
                category: "patients",
                format: "pdf",
                params: this.letterParamsData(),
                openInNewTab: true,
                generateUrl: true
            });

            return this;
        },

        /**
         * Open Estimation Letter Dialog with custom modal
         */
        openLetter: function () {
            var self = this;

            var facility = app.facilities.find(function (item) {
                return  item.id === self.data.visit.facilityId;
            });

            this.data.currentDate = moment().format('MM/DD/YYYY');
            this.data.facilityLogo = facility.facility_logo || '';

            var raw_html = this.printLetterTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);

            commonjs.showEstimationLetterDialog({
                header: "Estimation Letter",
                i18nHeader: 'patient.patientInsurance.eligibility.estimationLetter',
                width: "60%",
                height: "80%",
                html: self.letterTemplate
            });

            $('#divLetterPrint').append(translated_html);
            $('#txtPatientEmail').val(this.data.patient.email);

            if (this.isValidEmailConfig()) {
                $("#txtPatientEmail").prop("disabled", false);
                $("#btnLetterEmail").prop("disabled", false);
            }

            $("#btnLetterPrint").off('click').click(function () {
                self.printLetter();
            });

            $("#btnLetterEmail").off('click').click(function () {
                self.sendEstimationLetter();
            });

            return this;
        },

        isValidEmailConfig: function() {
            var emailConfig = _.get(app.company, 'email_config', {})
            if ( !emailConfig.from_address
                    || emailConfig.port <= 0
                    || !emailConfig.smtpserver
                    || !emailConfig.password
                    || !emailConfig.username
                ) {
                    return false;
                }

            return true;
        },

         /**
         * Send Estimation Letter to patient
         */
        sendEstimationLetter: function () {
            var raw_html = this.printLetterTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);
            var delivery_address = $("#txtPatientEmail").val().trim();

            if (!delivery_address || !commonjs.validateMailID(delivery_address)) {
                commonjs.showWarning('messages.warning.setup.pleaseEnterValidEmailID');
                $("#txtPatientEmail").focus();
                return false;
            }

            $.ajax({
                url: "/sendEstimationLetter",
                type: "POST",
                data: {
                    delivery_address: $('#txtPatientEmail').val(),
                    delivery_data: translated_html,
                },
                success: function () {
                    commonjs.showStatus("messages.status.patientEstimationLetter");
                },
                error: function (err, response) {
                    commonjs.handleXhrError(err, response);
                }
            });

            return this;
        },

        /**
         * Print
         */
        print: function () {
            var raw_html = this.printTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);
            var win = window.open();

            win.document.open();
            win.document.write(translated_html);
            win.document.close();
            win.print();
            win.close();

            return this;
        },

        /**
         * Scrolls the estimation area to the top
         */
        scrollToTopOfEstimation: function () {
            $("#divImagineEstimation").animate({ scrollTop: 0 }, "fast");
            return this;
        },

        /**
         * Shows either the eligibility or estimation loading message
         *
         * @param {string} type  "eligibility" or "estimation"
         */
        showLoading: function (type) {
            type === "estimation"
                ? commonjs.showLoading(commonjs.geti18NString("patient.patientInsurance.eligibility.fetchEstimation"))
                : commonjs.showLoading(commonjs.geti18NString("patient.patientInsurance.eligibility.fetchEligibility"));

            return this;
        },

        /**
         * Refresh the eligibility status and request date
         */
        updateEligibilityStatus: function () {
            var is_eligible = this.isEligible();
            var request_dt = _.get(this, "data.eligibility.dateCreated");

            this.data.eligibility_view.eligibilityDateVerified(is_eligible, request_dt);

            return this;
        },

        /**
         * Refresh i18n
         */
        updateCulture: function () {
            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
            return this;
        },

        /**
         * Update Selected - Clears estimation data and reruns the fetch with the currently selected studies
         */
        updateSelected: function () {
            if (_.isEmpty(this.selectedStudyIds())) {
                return commonjs.showWarning("messages.warning.selectStudies");
            }

            this.data.estimation = {};
            this.activateEstimation();

            return this;
        },
        /* #endregion */

        /* #region DOM Manipulation */
        // --------------------------------------------------------------------------------
        //                                 DOM MANIPULATION
        // --------------------------------------------------------------------------------

        /**
         * Activates the Eligibility tab
         */
        activateEligibility: function () {
            var self = this;

            this.loadEligibility(function () {
                $("#btnReestimate").hide();
                $("#btnReestimateWarning").hide();
                $("#btnEstimationLetter").hide();
                $("#btnGoodFaithLetter").hide();
                $("#divImagineEligibility").hide();
                $("#divImagineEligibilityError").hide();
                $("#btnPrintEligibility").hide();
                $("#divImagineEstimation").hide();
                $("#divImagineEstimationError").hide();

                if (self.eligibilityRequestError()) {
                    $("#divImagineEligibilityError").show();
                    $("#divImagineEligibilityError").text(self.eligibilityErrorMessage());
                }
                else {
                    $("#divImagineEligibility").show();
                    $("#btnRecheckEligibility").show();
                    $("#btnPrintEligibility").show();
                }

                $(".clickImagineEstimation").removeClass("active");
                $(".clickImagineEligibility").addClass("active");
            });

            return this;
        },

        /**
         * Activates the Estimation tab
         */
        activateEstimation: function () {
            var self = this;

            this.loadEstimation(function () {
                $("#divImagineEligibility").hide();
                $("#btnRecheckEligibility").hide();
                $("#btnPrintEligibility").hide();
                $("#divImagineEstimation").hide();
                $("#divImagineEligibilityError").hide();
                $("#divImagineEstimationError").hide();
                $("#btnReestimate").hide();
                $("#btnReestimateWarning").hide();

                if (self.estimationRequestError()) {
                    $("#divImagineEstimationError").show();
                    $("#divImagineEstimationError").text(self.estimationErrorMessage());
                }
                else {
                    $("#divImagineEstimation").show();
                    $("#btnEstimationLetter").show();
                    $("#btnPrintEligibility").show();
                    $("#btnGoodFaithLetter").show();
                }

                self.data.eligibility.isStale
                    ? $("#btnReestimateWarning").show()
                    : $("#btnReestimate").show();

                $(".clickImagineEligibility").removeClass("active");
                $(".clickImagineEstimation").addClass("active");
            });

            return this;
        },

        /**
         * No need for the Print button for secondary and tertiary insurances
         */
        removePrintButton: function () {
            if (this.data.insurance.coverageLevel !== "primary") {
                $("#btnPrintEligibility").remove();
            }

            return this;
        },

        /**
         * Disable Re-Check buttons for read-only users
         * No need for the Re-Check buttons on the New Order screen
         */
        removeRecheckButtons: function () {
            if (this.readOnlyPermission()) {
                $("#btnRecheckEligibility").prop("disabled", true);
                $("#btnReestimate").prop("disabled", true);
            }

            if (this.isMode("P")) {
                $("#btnRecheckEligibility").remove();
                $("#btnReestimate").remove();
            }

            return this;
        },

        /**
         * Toggles the header
         */
        toggleHeader: function () {
            $("#divImagineSoftwareHeader").slideToggle("fast", function () {
                var $btn = $("#btnToggleHeader");

                if ($(this).is(":hidden")) {
                    $btn
                        .find("i")
                        .removeClass("fa-caret-up")
                        .addClass("fa-caret-down");
                }
                else {
                    $btn
                        .find("i")
                        .removeClass("fa-caret-down")
                        .addClass("fa-caret-up");
                }
            });

            return this;
        },

        /**
         * Writes values to the DOM
         */
        writeFormValues: function () {
            this.writeFormValuesPatient()
                .writeFormValuesEligibilityStatus()
                .writeFormValuesBenefitsDate()
                .writeFormValuesVisit()
                .writeFormValuesInsurance()
                .writeFormValuesEligibility();

            return this;
        },

        /**
         * Writes the benefits date to the form
         */
        writeFormValuesBenefitsDate: function () {
            $("#divPatientBenefitsDate").text(this.data.eligibility.dateCreatedDisplay);
            return this;
        },

        /**
         * Writes eligibility data to the form
         */
        writeFormValuesEligibility: function () {
            var self = this;

            $("#divEligibilityPlanDetails").text(this.data.eligibility.planDetailsDisplay);

            this.eligibilityItems().forEach(function (item) {
                self.writeEligibilityItem(item.el, item.value);
            });

            return this;
        },

        /**
         * Writes the eligibility status icon to the form
         */
        writeFormValuesEligibilityStatus: function () {
            $("#iPatientEligibilityStatus")
                .removeClass()
                .addClass("fa fa-2x")
                .addClass(this.data.eligibilityStatus.icon)
                .addClass(this.data.eligibilityStatus.color);

            return this;
        },

        /**
         * Writes estimation data to the form
         */
        writeFormValuesEstimation: function () {
            var self = this;

            $(".imagine-estimation").each(function (index, el) {
                var $el = $(el);
                var name = $el.data("item");
                var amount = self.getEstimationValue(name);
                var max = self.getEstimationValue("max-" + name);
                var min = self.getEstimationValue("min-" + name);

                $el.find(".imagine-estimation__amount").text(amount);

                if (max) {
                    $el.find(".imagine-estimation__max").text(max);
                }

                if (min) {
                    $el.find(".imagine-estimation__min").text(min);
                }
            });

            $("#txtEstimatedPatientBalance").text(this.data.estimation.balanceDueDisplay);

            return this;
        },

        /**
         * Writes insurance data to the form
         */
        writeFormValuesInsurance: function () {
            var data = this.data.insurance;

            $("#divInsuranceProviderName").text(data.providerName);
            $("#divInsuranceAddress1").text(data.address1Display);
            $("#divInsuranceAddress2").text(data.address2Display);
            $("#divInsurancePolicyNumber").text(data.policyNumber);
            $("#divInsuranceSubscriberName").text(data.subscriberName);
            $("#divInsuranceSubscriberDob").text(moment(data.subscriberDob).format("L"));

            return this;
        },

        /**
         * Writes patient data to the form
         */
        writeFormValuesPatient: function () {
            var data = this.data.patient;

            $("#divPatientNameIS").text(data.name);
            $("#divPatientHomePhoneIS").text(data.homePhone);
            $("#divPatientMobilePhoneIS").text(data.mobilePhone);

            return this;
        },

        /**
         * Writes visit data to the form
         */
        writeFormValuesVisit: function () {
            var self = this;
            var data = this.data.visit;
            var referring_physicians = this.uniqueReferringPhysicians();

            $("#divVisitProcedures").text(data.proceduresDisplay);
            $("#divVisitDateOfService").text(moment(data.dateOfService).format("L"));
            $("#divVisitReferringPhysician").empty();

            referring_physicians.forEach(function (ref, index) {
                var info = ref.contact_info;

                if (info) {
                    var contact = {
                        name: ref.name || "",
                        address1: info.ADDR1 || "",
                        address2: info.ADDR2 || "",
                        city: info.CITY || "",
                        state: (info.STATE_NAME !== "Select" && info.STATE_NAME) || info.STATE || "",
                        zip: info.ZIP || "",
                        office_phone: info.OFPHNO || info.phone || "",
                        phone: info.PHNO || "",
                        mobile: info.MOBNO || "",
                        pager: info.PAGRNO || "",
                        fax: info.OFFAXNO || info.FAXNO || "",
                        email: info.EMAIL || "",
                        provider_alerts: info.providerAlerts || ""
                    };

                    self.writeReferringPhysicians(contact, index);
                }
            });

            return this;
        },

        /**
         * Writes a single eligibility item
         *
         * @param {string}   el
         * @param {object[]} item_list
         */
        writeEligibilityItem: function (el, item_list) {
            var self = this;
            var $el = $(el);
            var html = "";

            item_list.forEach(function (item) {
                html += self.eligibilityItemTemplate({ data: item });
            });

            $el.html(html);

            return this;
        },

        /**
         * Writes the patient info in the modal header
         */
        writeModalHeader: function () {
            var p = this.data.patient;
            var dob = p.dob ? moment(p.dob).format("L") : "";
            var text = ": " + p.name + " (" + p.mrn + ") " + dob + ", " + p.gender + ", " + this.firstStudyAge();

            $("#spanModalHeaderNested").append(text);

            return this;
        },

        /**
         * Write a Referring Physician with a popover
         *
         * @param {object} contact
         * @param {number} index
         */
        writeReferringPhysicians: function (contact, index) {
            // Physician template
            $("#divVisitReferringPhysician").append(this.iconNameTemplate({
                data: {
                    id: "divImagineSoftwareRefPhy" + index,
                    name: contact.name,
                    iconCss: "fa fa-user-md",
                    popover: true
                }
            }));

            // Popover box
            var $phyEle = $("#divVisitReferringPhysician").find("#divImagineSoftwareRefPhy" + index);
            $phyEle.popover({
                html: true,
                container: "body",
                placement: "bottom",
                content: this.providerAlertTemplate({
                    provider: contact,
                    labels: {
                        office_phone: commonjs.geti18NString("shared.fields.officePhone"),
                        phone: commonjs.geti18NString("shared.fields.phone"),
                        mobile: commonjs.geti18NString("shared.fields.mobilePhone"),
                        office_fax: commonjs.geti18NString("shared.fields.officeFax"),
                        fax: commonjs.geti18NString("shared.fields.fax"),
                        pager: commonjs.geti18NString("shared.fields.pager")
                    }
                })
            });

            // When openning a physician popover, close any other opened popovers
            $phyEle.on("show.bs.popover", function () {
                $(".popover").popover("hide");
            });
        },

        /**
         * Writes the study selection checkboxes to the form
         */
        writeStudyIdSelection: function () {
            var html = "";

            this.data.studies.forEach(function (study) {
                var id = study.id || study.lock_slot_id;
                var cpt_codes = (study.cptDetails || []).map(function (cpt) {
                    return cpt.code;
                }).join(", ");
                var desc = study.study_description + " - CPT " + cpt_codes;

                html += "" +
                    "<div>" +
                    "    <input type='checkbox' id='chkStudy" + id + "' value='" + id + "' checked />" +
                    "    <label for='chkStudy" + id + "'>" + desc + "</label>" +
                    "</div>";
            });

            $("#divEstimationStudies").html(html);

            // Bind on-click event for all study checkboxes
            $("INPUT[id^='chkStudy']").off("click").click(function () {
                $("#btnUpdateSelected").show();
            });

            return this;
        },

        /**
         * Hide or shows the Estimation tab based on the coverage level
         */
        visibleStateEstimationTab: function () {
            this.data.insurance.coverageLevel === "primary" && (!this.readOnlyPermission() || this.data.estimation_id > 0)
                ? $(".clickImagineEstimation").show()
                : $(".clickImagineEstimation").hide();

            return this;
        },
        /* #endregion */

        /* #region Formatters and Converters */
        // --------------------------------------------------------------------------------
        //                             FORMATTERS & CONVERTERS
        // --------------------------------------------------------------------------------

        /**
         * Parses an eligibility item to be written to the DOM
         *
         * @param {string} text
         * @returns {string[]}
         */
        formatAdditionalInsuranceInformation: function (text) {
            var arrItems = (text || "").split("~~");

            return arrItems.map(function (item) {
                var tokens = item.split("|");
                var formatted_tokens = tokens.map(function (token) {
                    var data = "";

                    if (_.includes(token, "-")) {
                        var first_hyphen = token.indexOf("-");
                        var label = _.trim(token.substring(0, first_hyphen));
                        var value = _.trim(token.substring(first_hyphen + 1));

                        data = label === label.toUpperCase()
                            ? label + " - " + value  // Label is all caps - this is a key/value pair
                            : token;
                    }
                    else {
                        data = token;
                    }

                    return commonjs.capitalizeEveryWord(data, ["and", "at", "but", "in", "of", "on", "or", "to", "with"]);
                });

                var last_token = _.last(formatted_tokens);
                var hasPlanBegin = _.startsWith(last_token, "Plan Begin");
                var insurance = hasPlanBegin
                    ? formatted_tokens.slice(0, -1)
                    : formatted_tokens;
                var description = hasPlanBegin
                    ? last_token
                    : "";

                return {
                    insurance: insurance.join(" | "),
                    description: description,
                    value: ""
                }
            });
        },

        /**
         * Formats a date while avoiding empty and bad date formats which would return Invalid Date
         *
         * @param {string} date
         * @returns {string}
         */
        formatDate: function (date) {
            return date && moment(date).isValid()
                ? moment(date).format("L")
                : "";
        },

        /**
         * Parses an eligibility item to be written to the DOM
         *
         * @param {string} text
         * @returns {string[]}
         */
        formatEligibilityItem: function (text) {
            var data = [];
            var arrItems = (text || "").split("~~");

            arrItems.forEach(function (item) {
                var arr_lines = item.split("~");
                var line_1 = arr_lines[0].replace(/\|/g, " - ");
                var line_2 = arr_lines[1];
                var arr_line_1 = line_1.split(":");

                var insurance = arr_line_1[0] || "";
                var value = arr_line_1[1] || "";
                var description = line_2 || "";

                if (insurance || value || description) {
                    data.push({
                        insurance: insurance,
                        description: description,
                        value: value
                    });
                }
            });

            return data;
        },

        /**
         * Formats an estimation value as a dollar amount
         *
         * @param {number} value
         * @returns {string}
         */
        formatEstimationValue: function (value) {
            return !_.includes(value, "$")
                ? "$" + parseFloat(value || 0).toFixed(2)
                : value;
        },

        /**
         * Hydrates formatted data for display
         */
        hydrateData: function () {
            // Patient
            this.data.patient.dobDisplay = this.formatDate(this.data.patient.dob);

            // Visit
            this.data.visit.dateOfServiceDisplay = this.formatDate(this.data.visit.dateOfService);
            this.data.visit.proceduresDisplay = (this.data.visit.procedures || []).map(function (cpt) {
                return cpt.code;
            }).join(", ");

            this.data.visit.referringPhysicianPrint = this.uniqueReferringPhysicians().map(function (ref) {
                return ref.name;
            });

            // Insurance
            this.data.insurance.address1Display = commonjs.formatAddress(this.data.insurance.address1, this.data.insurance.address2);
            this.data.insurance.address2Display = commonjs.formatCityStateZip(this.data.insurance.city, this.data.insurance.state, this.data.insurance.zip);
            this.data.insurance.subscriberDobDisplay = this.formatDate(this.data.insurance.subscriberDob);

            // Eligibility
            this.data.eligibility.planDetailsDisplay = _.get(this, "data.eligibility.planDetails", "").replace(/\|/g, " - ").replace(/~~/g, " ");
            this.data.eligibility.coInsurance = this.formatEligibilityItem(this.data.eligibility.discoveredPlanCoinsuranceIndividual);
            this.data.eligibility.coPay = this.formatEligibilityItem(this.data.eligibility.discoveredPlanCopayIndividual);
            this.data.eligibility.deductible = this.formatEligibilityItem(this.data.eligibility.discoveredPlanDeductibleIndividual);
            this.data.eligibility.outOfPocket = this.formatEligibilityItem(this.data.eligibility.discoveredPlanOutofPocketIndividual);
            this.data.eligibility.additionalInsuranceInformation = this.formatAdditionalInsuranceInformation(this.data.eligibility.additionalInsuranceInformation);
            this.data.eligibility.dateCreatedDisplay = this.formatDate(_.get(this.data, "eligibility.dateCreated"));

            // Eligibility Status
            var is_eligible = this.isEligible();
            var icon, color, printIcon, printColor;

            if (is_eligible) {
                icon = "fa-check-circle";
                color = "menu-icon-green";
                printIcon = "&#10004;";
                printColor = "green";
            }
            else {
                icon = "fa-times-circle";
                color = "menu-icon-red";
                printIcon = "&#10006;";
                printColor = "red";
            }

            this.data.eligibilityStatus = {
                icon: icon,
                color: color,
                printIcon: printIcon,
                printColor: printColor
            };

            return this;
        },

        /**
         * Hydrates estimation data for display
         */
        hydrateDataEstimation: function () {
            var self = this;

            this.estimationValueProps().forEach(function (prop) {
                self.data.estimation[prop + "Display"] = self.formatEstimationValue(self.data.estimation[prop]);
            });

            return this;
        },

        /**
         * Returns the sae string with the first letter in lower-case
         *
         * @param {string} str
         * @returns {string}
         */
        lowerFirstLetter: function (str) {
            return str.charAt(0).toLowerCase() + str.slice(1);
        },
        /* #endregion */

        /* #region Setters */
        // --------------------------------------------------------------------------------
        //                                     SETTERS
        // --------------------------------------------------------------------------------

        /**
         * Creates a new eligibility data entry on the parent view to track request
         * locally until order creation
         */
        createNewParentEligibilityData: function () {
            var view = _.get(this, "data.parent.view");
            var getter_fn = _.get(this, "data.parent.getter");
            var coverage_level = this.data.insurance.coverageLevel;
            var lock_slot_ids = this.selectedStudyIds();

            if (view && getter_fn) {
                view[getter_fn](coverage_level, lock_slot_ids);
            }

            return this;
        },

        /**
         * Sets data on the parent view (New Order screen ATM) using the parent view and setter
         *
         * @param {string} prop
         * @param {object} data
         */
        setParentData: function (prop, data) {
            var view = _.get(this, "data.parent.view");
            var setter_fn = _.get(this, "data.parent.setter");

            if (view && setter_fn) {
                view[setter_fn](prop, data);
            }

            return this;
        },
        /* #endregion */

        /* #region Getters */
        // --------------------------------------------------------------------------------
        //                                     GETTERS
        // --------------------------------------------------------------------------------

        /**
         * Returns all but the first procedure code
         *
         * @returns {string[]}
         */
        additionalProcedures: function () {
            var procedures = this.data.visit.procedures;

            return Array.isArray(procedures) && procedures.length > 1
                ? procedures.slice(1)
                : [];
        },

        /**
         * Returns all of the study ids from the list of study checkboxes
         *
         * @returns {number[]}
         */
        allStudyIds: function () {
            return $("INPUT[id^='chkStudy']").map(function () {
                return this.value;
            }).toArray();
        },

        /**
         * Returns the data stored in the eligibility view
         *
         * @returns {object[]}
         */
        dataStore: function () {
            var view = _.get(this, "data.parent.view");
            var data_prop = _.get(this, "data.parent.data");

            return view && data_prop && view[data_prop] || [];
        },

        /**
         * Returns the eligibility error message
         *
         * @returns {string}
         */
        eligibilityErrorMessage: function () {
            var eligibility = this.data.eligibility || {};

            return (
                _.get(eligibility, "responseJSON.errorDesc") ||
                i18n.get("messages.warning.patient.eligibilityCouldNotBePerformed")
            );
        },

        /**
         * Indicates if the eligibility request resulted in an error
         *
         * @returns {boolean}
         */
         eligibilityRequestError: function () {
            var eligibility = this.data.eligibility || {};

            return (
                _.toUpper(eligibility.statusText) === "ERROR" ||
                _.get(eligibility, "responseJSON.errorDesc")
            );
        },

        /**
         * Returns an array of objects that tie together the DOM elements with the values to write in the Eligibility section
         *
         * @returns {object[]}
         */
        eligibilityItems: function () {
            var data = this.data.eligibility;

            return [
                { el: "#divEligibilityCoInsurance", value: data.coInsurance },
                { el: "#divEligibilityCoPay", value: data.coPay },
                { el: "#divEligibilityDeductible", value: data.deductible },
                { el: "#divEligibilityOutOfPocket", value: data.outOfPocket },
                { el: "#divEligibilityAdditionalInsurance", value: data.additionalInsuranceInformation }
            ];
        },

        /**
         * Returns the estimation error message
         *
         * @returns {string}
         */
        estimationErrorMessage: function () {
            var estimation = this.data.estimation || {};

            return (
                estimation.message ||
                _.get(estimation, "responseJSON.errorDesc") ||
                i18n.get("messages.warning.patient.estimationCouldNotBePerformed")
            );
        },

        /**
         * Indicates if the estimation request resulted in an error
         *
         * @returns {boolean}
         */
        estimationRequestError: function () {
            var estimation = this.data.estimation || {};

            return (
                _.toUpper(estimation.status) === "FAILED" ||
                !!estimation.message ||
                _.get(estimation, "responseJSON.errorDesc")
            );
        },

        /**
         * Returns all estimation value property name
         *
         * @returns {string[]}
         */
        estimationValueProps: function () {
            return [
                "balanceDue",
                "coInsurance",
                "coPay",
                "deductible",
                "maxBalanceDue",
                "maxDeductible",
                "maxOutOfPocket",
                "patientResponsibleAmount"
            ];
        },

        /**
         * Returns existing eligibility data from a request that's already been run
         *
         * @returns {object|null}
         */
        existingEligibilityData: function () {
            var data_store = this.dataStore();
            var order_data = this.orderDataBySelectedIds();

            return data_store.filter(function (item) {
                return item && _.isEqual(item.params, order_data);
            })[0] || null;
        },

        /**
         * Returns the first procedure code
         *
         * @returns {string}
         */
        firstProcedure: function () {
            var procedures = this.data.visit.procedures;

            return !_.isEmpty(procedures)
                ? procedures[0]
                : {};
        },

        /**
         * Returns the reason for study of the first study
         *
         * @returns {string}
         */
        firstReasonForStudy: function () {
            return _.get(this.data, "studies[0].reason_for_study", "");
        },

        /**
         * Returns the patient's age at the time of the first study
         *
         * @returns {string}
         */
        firstStudyAge: function () {
            return _.get(this.data, "studies[0].study_age", "");
        },

        /**
         * Returns the description of the first study
         *
         * @returns {string}
         */
        firstStudyDescription: function () {
            return _.get(this.data, "studies[0].study_description", "");
        },

        /**
         * Returns a value associated with a name / label
         *
         * @param {string} name
         * @returns {string}
         */
        getEstimationValue: function (name) {
            var o = this.data.estimation;

            switch (name) {
                case "balance-due": return o.balanceDueDisplay;
                case "co-insurance": return o.coInsuranceDisplay;
                case "co-pay": return o.coPayDisplay;
                case "deductible": return o.deductibleDisplay;
                case "max-balance-due": return o.maxBalanceDueDisplay;
                case "max-deductible": return o.maxDeductibleDisplay;
                case "max-out-of-pocket": return o.maxOutOfPocketDisplay;
            }

            return "";
        },

        /**
         * Gets the relation description from the provided id
         *
         * @param {number} id
         * @returns {string}
         */
        getRealationById: function (id) {
            var relation = _.find(app.settings.relationships, function (item) {
                return ~~item.id === ~~id;
            }) || {};

            return relation.description || "";
        },

        /**
         * Gathers the good faith estimate letter params data
         *
         * @returns {object}
         */
         letterParamsData: function () {
            return {
                patient_id: this.data.patient.id,
                facility_id: this.data.visit.facilityId,
                study_ids: this.getStudyIds(),
                appointment_type_ids: this.getAppointmentIds(),
                balance_due: this.data.estimation.balanceDue,
                procedure_estimates: this.data.estimation.procedureEstimates,
                claim_id: this.data.claim_id,
                async: false,
                save: false
            }
        },

        /**
         * Gets the appointment type Ids
         *
         * @returns {number[]}
         */
        getAppointmentIds: function () {
           return this.data.studies.reduce(function (appointmentIds, study) {
                if (study.appointment) {
                    appointmentIds.push(study.appointment);
                }
                return appointmentIds;
            }, []);
        },

        /**
         * Gets the study Ids
         *
         * @returns {number[]}
         */
        getStudyIds: function () {
            return this.data.studies.reduce(function (studyIds, study) {
                if (study.id) {
                    studyIds.push(study.id);
                }
                return studyIds;
            }, []);
        },

        /**
         * Indicates if the eligibility request is eligible
         *
         * @returns {boolean}
         */
        isEligible: function () {
            return !!~~_.get(this, "data.eligibility.isEligible");
        },

        /**
         * Indicates if the mode is "studies" or "params"
         *   studies - Studies have already been created and exist in the db
         *   params - No studies exist yet (New Order page)
         *
         * @param {string} mode
         * @returns {boolean}
         */
        isMode: function (mode) {
            if (mode === "P") {
                return this.data.mode === "params";
            }

            if (mode === "S") {
                return this.data.mode === "studies";
            }

            return false;
        },

        /**
         * Indicates whether eligibility data is needed or has already been acquired
         *
         * @returns {boolean}
         */
        needEligibilityData: function () {
            return _.isEmpty(this.data.eligibility);
        },

        /**
         * Indicates whether estimation data is needed or has already been acquired
         *
         * @returns {boolean}
         */
        needEstimationData: function () {
            return _.isEmpty(this.data.estimation);
        },

        /**
         * Returns the original order data filtered by the studies selected
         *
         * @returns {object}
         */
        orderDataBySelectedIds: function () {
            var order_data = _.cloneDeep(this.data.original_order_data);
            var lock_slot_ids = this.selectedStudyIds();
            var filtered_studies = (order_data.studies || []).filter(function (study) {
                return _.includes(lock_slot_ids, study.lock_slot_id);
            });

            order_data.studies = filtered_studies || [];

            return order_data;
        },

        /**
         * Returns Ajax data parameters for the "params" eligibility and estimation APIs
         *
         * @returns {object}
         */
        paramsData: function () {
            var i = this.data.insurance;
            var p = this.data.patient;
            var v = this.data.visit;

            return {
                requestId: this.requestId(),
                eligibilityPayerId: i.tradingPartnerId,
                insPlanCode: i.code,
                insuredGender: i.subscriberGender,
                insuredFirstName: i.subscriberFirstName,
                insuredLastName: i.subscriberLastName,
                insuredDob: i.subscriberDob,
                insuredRelation: this.getRealationById(i.relationId),
                policyNumber: i.policyNumber,
                insuranceProviderName: i.providerName,
                patient_id: p.id,
                providerId: v.externalProviderId,

                patientIdentifier: p.mrn,
                patientFirstName: p.firstName,
                patientLastName: p.lastName,
                visitIdentifier: commonjs.generateRandomNumber(),
                dateOfService: v.dateOfService,
                patientAddress: p.address1,
                patientAddress2: p.address2,
                patientCity: p.city,
                patientDOB: p.dob,
                patientGender: p.gender,
                patientMiddleName: p.middleName,
                patientState: p.state,
                patientZip: p.zip,
                patientEmail: p.email,
                reason: this.firstReasonForStudy(),
                procedureCode: this.firstProcedure().code,
                procedureFee: ~~this.firstProcedure().fee,
                procedureDescription: this.firstProcedure().description,
                isTrueSelfPay: false,
                planCode: i.code,
                serviceType: this.serviceTypes(),
                additionalProcedures: this.additionalProcedures()
            }
        },

        /**
         * Indicates that the user only has read-only permission
         *
         * @returns {boolean}
         */
        readOnlyPermission: function () {
            return app.checkPermissionCode("ELGR") && !app.checkPermissionCode("ELIG");
        },

        /**
         * Returns all of the service types from the order data
         *
         * @returns {string}
         */
        serviceTypes: function () {
            return (this.data.service_types || []).join("^");
        },

        /**
         * Returns all of the selected study ids from the list of study checkboxes
         *
         * @returns {number[]}
         */
        selectedStudyIds: function () {
            return $("INPUT[id^='chkStudy']:checked").map(function () {
                return this.value;
            }).toArray();
        },

        /**
         * Returns Ajax data parameters for the "studies" eligibility and estimation APIs
         *
         * @returns {object}
         */
        studiesData: function () {
            return {
                studyIds: this.selectedStudyIds(),
                patientInsuranceId: this.data.insurance.id,
                serviceType: this.serviceTypes()
            }
        },

        /**
         * Get a list of unique referring physicians from all of the orders
         *
         * @returns {number[]}
         */
        uniqueReferringPhysicians: function () {
            if (this.isMode("P")) {
                return _.chain(this.data.studies)
                    .map(function (item) {
                        var name = item.refDescription || "";
                        var alert = item.referring_physician_alert || "";

                        if (name) {
                            return {
                                name: name,
                                contact_info: {
                                    providerAlerts: alert
                                }
                            }
                        }

                        return [];
                    })
                    .uniqBy("name")
                    .filter(function (item) { return !_.isEmpty(item) })
                    .take(5)
                    .value();
            }

            if (this.isMode("S")) {
                return _.chain(this.data.studies)
                    .map(function (item) { return item.referring_physician; })      // Map referring physicians from all orders
                    .flatten()                                                      // Flatten the chunked array
                    .uniqBy("provider_contact_id")                                  // Strip out duplicate referring physicians
                    .filter(function (item) { return !!item.provider_contact_id; }) // Filter out any empty entries
                    .take(5)
                    .value();
            }

            return [];
        }
        /* #endregion */
    });

    return insuranceImagineSoftware;
});
