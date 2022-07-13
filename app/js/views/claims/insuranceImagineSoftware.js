define([
    "jquery",
    "underscore",
    "backbone",
    "text!templates/icon_and_name.html",
    "text!templates/providerAlert.html",
    "text!templates/claims/insuranceImagineSoftware.html",
    "text!templates/claims/insuranceImagineSoftwarePrint.html",
    "text!templates/claims/insuranceImagineSoftwareEligibilityItem.html",
    "text!templates/claims/insuranceImagineSoftwareLetterPrint.html",
    "text!templates/claims/insuranceImagineSoftwareLetter.html"
],
function (
    $,
    _,
    Backbone,
    IconNameTemplate,
    ProviderAlertTemplate,
    ImagineSoftwareTemplate,
    ImagineSoftwarePrintTemplate,
    EligibilityItemTemplate,
    imagineSoftwareLetterPrintTemplate,
    imagineSoftwareLetterTemplate

) {
    var insuranceImagineSoftware = Backbone.View.extend({
        el: null,
        rendered: false,
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
            "click #btnRecheckEligibility": "handleClickRecheckEligibility",
            "click #btnEstimationLetter": "handleClickLetter",
            "click #btnPrintEligibility": "handleClickPrint",
            "click #btnUpdateSelected": "handleClickUpdateSelected",
            "click .clickImagineEligibility": "handleClickTabEligibility",
            "click .clickImagineEstimation": "handleClickTabEstimation",
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

        handleClickLetter: function (e) {
            this.openLetter();
        },

        handleClickPrint: function (e) {
            this.print();
        },

        handleClickReestimate: function (e) {
            this.reestimate(this.handleEstimationData.bind(this));
        },

        handleClickRecheckEligibility: function (e) {
            this.recheckEligibility(this.handleEligibilityData.bind(this));
        },

        handleClickTabEligibility: function (e) {
            this.activateEligibility();
        },

        handleClickTabEstimation: function (e) {
            this.activateEstimation();
        },

        handleClickToggleHeader: function (e) {
            this.toggleHeader();
        },

        handleClickUpdateSelected: function (e) {
            this.updateSelected();
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
                    .updateCulture();
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
                return this.fetchEligibilityParams(callback);
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

            commonjs.showLoading();

            $.ajax({
                url: "/imagineSoftware/eligibilityForParams",
                type: "POST",
                data: this.paramsData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
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

            commonjs.showLoading();

            $.ajax({
                url: "/imagineSoftware/eligibilityForStudies",
                type: "POST",
                data: this.studiesData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
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
                return this.fetchEligibilityParams(callback);
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

            commonjs.showLoading();

            $.ajax({
                url: "/imagineSoftware/estimationForParams",
                type: "POST",
                data: this.paramsData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
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

            commonjs.showLoading();

            $.ajax({
                url: "/imagineSoftware/estimationForStudies",
                type: "POST",
                data: this.studiesData(),
                success: function (data) {
                    commonjs.hideLoading();
                    return callback(data.result);
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
         * Fetches estimation data and writes the form values
         *
         * @param {function} callback
         */
        loadEstimation: function (callback) {
            callback = commonjs.ensureCallback(callback);

            if (this.needEstimationData()) {
                var self = this;

                this.fetchEstimation(function (estimation_data) {
                    self.handleEstimationData(estimation_data);

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
                .writeFormValuesEstimation();
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
                .updateCulture();
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
         * Open Estimation Letter Dialog with custom modal
         */
        openLetter: function () {
            var self = this;

            var facility = app.facilities.find(function (item) {
                return  item.id === self.data.visit.facility_id;
            });

            this.data.currentDate = new Date().toLocaleDateString();
            this.data.facilityLogo = facility.facility_logo || '';

            var raw_html = this.printLetterTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);

            $('<div id="estimationLetterDialog"></div>').dialog( {
                modal: true,
                width: 900,
                height: 300,
                resizable : false,
                draggable: false,
                title: commonjs.geti18NString('patient.patientInsurance.eligibility.estimationLetter'),
                open: function () {
                    $('#estimationLetterDialog').append(self.letterTemplate());
                    $('#divLetterPrint').append(translated_html);
                    self.initializeLetterCustomDialog();
                },
                close: function() {
                    $("#siteModal").prop('style').removeProperty("z-index");
                    $(this).dialog("destroy");
                }
            });

            $('#txtPatientEmail').val(this.data.patient.email);

            if (this.isValidEmailConfig()) {
                $("#txtPatientEmail").prop("disabled", false);
                $("#btnLetterEmail").prop("disabled", false);
            }

            $("#btnLetterPrint").off('click').click(function (e) {
                self.printLetter();
            });

            $("#btnLetterEmail").off('click').click(function (e) {
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

        initializeLetterCustomDialog: function () {
            var windowWidth = $window.width();
            var windowHeight = $window.height();
            var width = (windowWidth / 100) * 60;
            var height = (windowHeight / 100) * 80;

            width = Math.min(width, window.innerWidth * 0.95);
            height = Math.min(height, window.innerHeight - 130);

            $("#estimationLetterDialog")
                .closest(".ui-dialog")
                .find(".ui-dialog-titlebar-close")
                .removeClass("ui-dialog-titlebar-close")
                .html("<span class='ui-button-icon-primary ui-icon ui-icon-closethick'></span>");

            $("#estimationLetterDialog").parent().css('background-color','white');
            $('.ui-widget-overlay, .ui-widget-header').css('background', 'rgb(43, 84, 126)');
            $('.ui-dialog-title').css("color", "white");
            $("#divEstimationLetter").css('height', height - 50 + 'px');
            $("#siteModal").css("z-index", "1");

            $(".ui-dialog").css({
                top: '100px',
                width: width + 'px',
                height: height + 'px'
            });
            $(".ui-dialog").addClass('imagine-letter__dialog')
            $('#estimationLetterDialog')
                .closest(".ui-dialog")
                .find("button")
                .addClass('imagine-letter-close__button')

            if (window.innerHeight > window.innerWidth) {
                var height = $window.height() / 2;
                $("#estimationLetterDialog").css('height', (height - 100) + 'px');
            }
            else {
                $("#estimationLetterDialog").css('height', height + 'px');
            }
        },

         /**
         * Send Estimation Letter to patient
         */
        sendEstimationLetter: function () {
            var raw_html = this.printLetterTemplate({ data: this.data });
            var translated_html = commonjs.i18nHtmlTranslate(raw_html);

            $.ajax({
                url: "/sendEstimationLetter",
                type: "POST",
                data: {
                    delivery_address: $('#txtPatientEmail').val(),
                    delivery_data: translated_html,
                },
                success: function (response) {
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
         * Re-estimate
         * @param {function} callback
         * @returns this
         */
        reestimate: function (callback) {
            callback = commonjs.ensureCallback(callback);

            var self = this;

            commonjs.showLoading();

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
                    return callback(data.result);
                },
                error: function (err) {
                    commonjs.handleXhrError(err);
                    return callback({});
                }
            });

            return this;
        },

        /**
         * Recheck eligibility
         * @param {function} callback
         * @returns this
         */
        recheckEligibility: function (callback) {
            callback = commonjs.ensureCallback(callback);

            var self = this;

            commonjs.showLoading();

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
                    return callback({});
                }
            });

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
         * Refresh i18n
         */
        updateCulture: function () {
            commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
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
            this.loadEligibility(function () {
                $("#btnReestimate").hide();
                $("#btnEstimationLetter").hide();
                $("#divImagineEstimation").hide();
                $("#divImagineEligibility").show();
                $("#btnRecheckEligibility").show();
                $(".clickImagineEstimation").removeClass("active");
                $(".clickImagineEligibility").addClass("active");
            });

            return this;
        },

        /**
         * Activates the Estimation tab
         */
        activateEstimation: function () {
            this.loadEstimation(function () {
                $("#divImagineEligibility").hide();
                $("#btnRecheckEligibility").hide();
                $("#divImagineEstimation").show();
                $("#btnEstimationLetter").show();
                $("#btnReestimate").show();
                $(".clickImagineEligibility").removeClass("active");
                $(".clickImagineEstimation").addClass("active");
            });

            return this;
        },

        /**
         * No need for the Print button for secondary and tertiary insurances
         */
        removePrintButton: function () {
            if (this.data.insurance.coverage_level !== "primary") {
                $("#btnPrintEligibility").remove();
            }

            return this;
        },

        /**
         * No need for the Re-Check buttons on the New Order screen
         */
        removeRecheckButtons: function () {
            if (this.isMode("P") || this.readOnlyPermission()) {
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
        writeFormValuesEligibilityStatus: function (is_eligible) {
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
            var self = this;
            var html = "";

            this.data.studies.forEach(function (study) {
                var id = study.id;
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
            $("INPUT[id^='chkStudy']").off("click").click(function (e) {
                self.visibleStateUpdateSelectedButton();
            });

            return this;
        },

        /**
         * Hide or shows the Estimation tab based on the coverage level
         */
        visibleStateEstimationTab: function () {
            this.data.insurance.coverage_level === "primary"
                ? $(".clickImagineEstimation").show()
                : $(".clickImagineEstimation").hide();

            return this;
        },

        /**
         * Hide or shows the Update Selected button based on how many studies are selected
         */
        visibleStateUpdateSelectedButton: function () {
            this.selectedStudyIds().length < this.allStudyIds().length
                ? $("#btnUpdateSelected").show()
                : $("#btnUpdateSelected").hide();

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
            // Visit
            this.data.visit.proceduresDisplay = (this.data.visit.procedures || []).map(function (cpt) {
                return cpt.code;
            }).join(", ");

            this.data.visit.referringPhysicianPrint = this.uniqueReferringPhysicians().map(function (ref) {
                return ref.name;
            });

            // Insurance
            this.data.insurance.address1Display = commonjs.formatAddress(this.data.insurance.address1, this.data.insurance.address2);
            this.data.insurance.address2Display = commonjs.formatCityStateZip(this.data.insurance.city, this.data.insurance.state, this.data.insurance.zip);

            // Eligibility
            this.data.eligibility.planDetailsDisplay = _.get(this, "data.eligibility.planDetails", "").replace(/\|/g, " - ").replace(/~~/g, " ");
            this.data.eligibility.coInsurance = this.formatEligibilityItem(this.data.eligibility.discoveredPlanCoinsuranceIndividual);
            this.data.eligibility.coPay = this.formatEligibilityItem(this.data.eligibility.discoveredPlanCopayIndividual);
            this.data.eligibility.deductible = this.formatEligibilityItem(this.data.eligibility.discoveredPlanDeductibleIndividual);
            this.data.eligibility.outOfPocket = this.formatEligibilityItem(this.data.eligibility.discoveredPlanOutofPocketIndividual);

            // Benefits Date
            var benefits_date = _.get(this, "data.eligibility.dateCreated");
            var display_date = benefits_date && !moment.isMoment(benefits_date)
                ? moment(benefits_date).format("L")
                : "";
            this.data.eligibility.dateCreatedDisplay = display_date;

            // Eligibility Status
            var is_eligible = !!~~this.data.eligibility.isEligible;
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
            return $("INPUT[id^='chkStudy']").map(function (el) {
                return this.value;
            }).toArray();
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
                { el: "#divEligibilityOutOfPocket", value: data.outOfPocket }
            ];
        },

        /**
         * Returns all estimation value property name
         *
         * @returns {string[]}
         */
        estimationValueProps: function () {
            return [
                "allowedAmount",
                "balanceDue",
                "coInsurance",
                "coPay",
                "deductible",
                "insuranceAdjustmentAmount",
                "insurancePayment",
                "patientResponsibleAmount",
                "stopLoss",
                "totalCharges",
                "maxAllowedAmount",
                "maxBalanceDue",
                "maxDeductible",
                "maxOutOfPocket",
                "maxPatientResponsibilityAmount",
                "maxTotalCharges",
                "minPatientResponsibilityAmount",
                "patientResponsibleAmount"
            ];
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
                case "allowed-amount": return o.allowedAmountDisplay;
                case "balance-due": return o.balanceDueDisplay;
                case "co-insurance": return o.coInsuranceDisplay;
                case "co-pay": return o.coPayDisplay;
                case "deductible": return o.deductibleDisplay;
                case "insurance-adjustment": return o.insuranceAdjustmentAmountDisplay;
                case "insurance-payment": return o.insurancePaymentDisplay;
                case "patient-responsibility": return o.patientResponsibleAmountDisplay;
                case "stop-loss": return o.stopLossDisplay;
                case "total-charges": return o.totalChargesDisplay;
                case "max-allowed-amount": return o.maxAllowedAmountDisplay;
                case "max-balance-due": return o.maxBalanceDueDisplay;
                case "max-deductible": return o.maxDeductibleDisplay;
                case "max-out-of-pocket": return o.maxOutOfPocketDisplay;
                case "max-patient-responsibility": return o.maxPatientResponsibilityAmountDisplay;
                case "max-total-charges": return o.maxTotalChargesDisplay;
                case "min-patient-responsibility": return o.minPatientResponsibilityAmountDisplay;
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
         * Returns Ajax data parameters for the "params" eligibility and estimation APIs
         *
         * @returns {object}
         */
        paramsData: function () {
            var i = this.data.insurance;
            var p = this.data.patient;
            var v = this.data.visit;

            return {
                requestId: null,
                eligibilityPayerId: "62308",
                eligibilityServiceTypeId: "30",
                modalityCode: "APA",
                estimationType: "OutPatient",
                // npi: null,
                // insPlanCode: null,
                insuredGender: i.subscriberGender,
                insuredFirstName: i.subscriberFirstName,
                insuredLastName: i.subscriberLastName,
                insuredDob: i.subscriberDob,
                insuredRelation: this.getRealationById(i.relation_id),
                policyNumber: i.policyNumber,
                insuranceProviderName: i.providerName,
                patient_id: p.id,

                providerId: 25,
                patientIdentifier: p.mrn,
                patientFirstName: p.firstName,
                patientLastName: p.lastName,
                visitIdentifier: commonjs.generateRandomNumber(),
                // balance: null,
                dateOfService: v.dateOfService,
                // maximumAmount: null,
                // minimumAmount: null,
                patientAddress: p.address1,
                patientAddress2: p.address2,
                patientCity: p.city,
                patientDOB: p.dob,
                patientGender: p.gender,
                patientMiddleName: p.middleName,
                // patientSSN: null,
                patientState: p.state,
                patientZip: p.zip,
                patientEmail: p.email,
                reason: this.firstReasonForStudy(),
                procedureCode: this.firstProcedure().code,
                procedureFee: ~~this.firstProcedure().fee,
                procedureDescription: this.firstProcedure().description,
                // npiNumber: null,
                isTrueSelfPay: false,
                planCode: "C1",
                serviceType: this.serviceTypes(),
                additionalProcedures: this.additionalProcedures()
                // priorBalance: null,
                // planName: null,
                // planId: null,
                // planAddress: null,
                // planZip: null,
                // planLocation: null
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
            return $("INPUT[id^='chkStudy']:checked").map(function (el) {
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
        },

        // ----------------------------------------------------------------------------------------
        // Test / Temp Functions - will be removed

        getTestDataEstimation: function () {
            return {
                "estimationId": 4680.0,
                "sessionId": 17853.0,
                "requestId": 13327.0,
                "dateCreated": "2022-02-15T15:57:16.923",
                "allowedAmount": 382.0000,
                "balanceDue": 20.0000,
                "coInsurance": 0.0000,
                "coPay": 20.0000,
                "deductible": 0.0000,
                "confidenceLevel": "Green",
                "dateofService": null,
                "encounter": "V98765",
                "externalEstimationId": 24677.0,
                "externalId": 24677.0,
                "hra": 0.0,
                "insuranceAdjustmentAmount": 628.0000,
                "insurancePayment": 362.0000,
                "maxAllowedAmount": 458.4000,
                "maxBalanceDue": 20.0000,
                "maxDeductible": 0.0000,
                "maxOutOfPocket": 0.0000,
                "maxPatientResponsibilityAmount": 20.0000,
                "maxTotalCharges": 1212.0000,
                "minPatientResponsibilityAmount": 20.0000,
                "patientResponsibleAmount": 20.0000,
                "stopLoss": 0.0000,
                "totalCharges": 1010.0000,
                "tierEstimate": {
                    "tierAllowedAmount": 382.0000,
                    "tierBalanceDue": 20.0000,
                    "tierCoInsurance": 0.0000,
                    "tierConfidenceLevel": "Green",
                    "tierCoPay": 20.0000,
                    "tierCreatedAt": "2022-02-15T20:57:16.873",
                    "tierDeductible": 0.0000,
                    "tierDeleted": false,
                    "tierDeletedAt": null,
                    "tierDos": "2021-11-03T23:35:13",
                    "tierEncounter": "V98765",
                    "tierEstimationId": 24677.0,
                    "tierHra": 0.0,
                    "tierId": 24677.0,
                    "tierInsuranceAdjustments": 628.0000,
                    "tierInsurancePayment": 362.0000,
                    "tierMaxAllowedAmount": 458.4000,
                    "tierMaxBalanceDue": 20.0000,
                    "tierMaxCoInsurance": 0.0000,
                    "tierMaxDeductible": 0.0000,
                    "tierMaxOutOfPocket": 0.0000,
                    "tierMaxPatientResponsibility": 20.0000,
                    "tierMaxTotalCharges": 1212.0000,
                    "tierMinPatientResponsibility": 20.0000,
                    "tierModifiedAt": "2022-02-15T20:57:16.873",
                    "tierPatientResponsibility": 20.0000,
                    "tierStopLoss": 0.0000,
                    "tierTotalCharges": 1010.0000
                },
                "eligibilityId": 12310.0
            }
        }
        /* #endregion */
    });

    return insuranceImagineSoftware;
});
