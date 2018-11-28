var layout = {

    currentModule: null,
    currentScreen: null,
    lastModule: null,
    lastScreen: null,

    initialized: false,
    setupDataUpdated: false,

    moduleLinkIds: {
        'Payments': '#aPayments',
        'Setup': '#aSetup',
        'Report': '#aReports',
        'report': '#aReports',
        'Claims': '#aClaims',
        'Studies': '#aStudies',
        'EOB': '#aEob',
        'Log': '#aLog',
    },

    moduleHeaders: {
        'Payments': 'Payments',
        'Setup': 'Setup',
        'Report': 'Report',
        'report': 'Report',
        'Claims': 'Claims',
        'Studies': 'Studies',
        'EOB': 'EOB',
        'Log': 'Log',
    },

    screenLinkIds: {
        'Adjustment Codes': '#aAdjustmentCodes',
        'Billing Codes': '#aBillingCodes',
        'Billing Classes': '#aBillingClasses',
        'Claim Status': '#aClaimStatus',
        'Billing Provider': '#aBillingProviders',
        'Provider ID Code Qualifiers': '#aProviderIdCodeQualifiers',
        'Payment Reasons': '#aPaymentReasons',
        'CAS Group Codes': '#aCasGroupCodes',
        'CAS Reason Codes': '#aCasReasonCodes',
        'Provider Level Codes': '#aProviderLevelCodes',
        'Billing Validations': '#aBillingValidations',
        'Status Color Codes': '#aStatusColorCodes',
        'EDI ClearingHouses': '#aEDIClearingHouses',
        'Insurance Mapping': '#aInsuranceX12Mapping',
        'Billing Messages': '#aBillingMessages',
        /// report navs
        'Charges': '#aCharges',
        'Claim Activity': '#aClaimActivity',
        'Claim Inquiry': '#aClaimInquiry',
        'Claim Transaction': '#aClaimTransaction',
        'Credit Balance Encounters': '#aCreditBalanceEncounters',
        'Date Of SVC Payment': '#aDateSVC',
        'Diagnosis Count': '#aDiagnosisCount',
        'Insurance VS LOP': '#aInsuranceLOP',
        'Modality Summary': '#aModalitySummary',
        'Monthly Recap': '#aMonthlyRecap',
        'Patient Statement': '#aPatientStatement',
        'Payer Mix': '#aPayerMix',
        'Payment': '#aPaymentDetails',
        'Patients By Insurance Company': '#aPatientsByInsCompany',
        'Aged AR Summary': '#aAgedARSummary',
        'Aged AR Details': '#aAgedARDetails',
        'Procedure Count': '#aProcedureCount',
        'Reading Provider Fees': '#aReadingProviderFees',
        'Referring Provider Summary': '#aRefProSummary',
        'Referring Provider Count': '#aRefProCount',
        'Procedure Analysis By Insurance': '#aProcedureAnlaysis',
        'Payments By Ins Company': '#aPaymentsByInsurance',
        'Transaction Summary': '#aTransactionSummary',
        'Audit Log': '#aAuditLog',
        'User Log': '#aUserLog',
        'EDI Templates': '#aEDITemplate',
        'Paper Claim Templates': '#aPaperClaimTemplate',
        'Printer Templates': '#aPrinterTemplate',
        'Payments Realization Rate Analysis': '#aPaymentsRealizationRateAnalysis'
        /// To be added
    },

    initializeLayout: function (router) {
        this.initialized = true;

        $('#content').css('min-width', '');

        commonjs.currentModule = router.options.module;
        $("#divValidationBlock").hide();

        if (!this.hasInitialized(router.options)) {
            this.setModuleLayout(router.options);
            this.initialized = false;
        }

        if (!this.initialized && router.options.currentView) {
            //router.options.currentView.undelegateEvents();
            this.killView(router.options.currentView);
        }

        $('#spanHeader').text(this.currentScreen);

        //commonjs.licenseCheck();

        this.initializeI18n();

        if (commonjs.arrInterval) {
            for (var i = 0; i < commonjs.arrInterval.length; i++) {
                clearInterval(commonjs.arrInterval[i]);
            }
        }

        this.lastModule = this.currentModule;
        this.lastScreen = this.currentScreen;
    },

    killView: function (viewObj) {
        if (viewObj) {
            viewObj.undelegateEvents();
        }
    },

    setModuleLayout: function (options) {
        if (app.userInfo.user_type == 'SU') {
            $('#li_selectuser').show();
        }

        if (this.currentModule != options.module) {
            //if(options.module != 'Home'){
            // commonjs.isHomePageVisited = false;
            // }
            this.currentModule = options.module;

            this.highlightMainMenu(options.module);

            if (options.outerLayout) {
                options.outerLayout.render();
            }
        }

        if (this.currentScreen != options.screen) {
            this.currentScreen = options.screen;
        }

        this.highlightSideMenu(options.module, options.screen);

        if (options.module == 'Setup') {
            $('#ancCompany').attr('href', '#setup/company/edit/' + app.company_code);
            if (app.userInfo.user_type == 'SU') {
                $('#side_nav_developerLog').show();
                $('#side_nav_dicomLog').show();
                $('#side_nav_moveLog').show();
                $('#side_nav_imageRenderingLog').show();
                $('#side_nav_HL7log').show();
                $('#side_nav_temp2LiveLog').show();
            }
        } else {
            $('#spchangeCurrentCompany').click(function (e) {
                e.stopPropagation();
                window.location.href = '#config/company/edit/' + app.company_code;
            });
        }
        if(app.userInfo.user_type != 'SU')
            (window.appRights).init();
        commonjs.hideLoading();
    },

    hasInitialized: function (options) {
        return this.currentScreen == options.screen;
    },

    checkLicense: function (currentScreen, isNotFromScreen, isReadOnly) {
        return commonjs.checkScreenRight(currentScreen, isNotFromScreen, isReadOnly);
    },

    highlightSideMenu: function (module, currentScreen) {

        switch (currentScreen) {
            case 'ClaimWorkbench':
                module = 'Claims';
                break;

            case 'Studies':
                module = 'Studies';
                break;

            case 'Era':
                module = 'EOB';
                break;
        }

        if (module == 'Setup') {
            $('#ulSetupNav').show();
            $('#ulLogNav').hide();

            if (currentScreen == 'User Log' || currentScreen == 'Audit Log') {
                $('#ulSetupNav').hide();
                $('#ulLogNav').show();
                module = 'Log';
            }
        }

        $('#navbarNavAltMarkup .active').removeClass('active');

        if (layout.moduleLinkIds[module]) {
            $(layout.moduleLinkIds[module]).addClass('active');
        }

        $('.settings-nav .active').removeClass('active');

        if (layout.screenLinkIds[currentScreen]) {
            $(layout.screenLinkIds[currentScreen]).addClass('active');
        }

        var screenTitle = layout.moduleHeaders[module] ? layout.moduleHeaders[module].toUpperCase() : 'BILLING';
        $('#aNavTitlebar').text(screenTitle);
        //$('#aNavTitlebar').attr("href", location.href);

        $('.daterangepicker').remove();
        this.triggerSettingsRefresh(module, currentScreen);

        document.title = layout.moduleHeaders[module] + ' - EXA Billing';
    },

    triggerSettingsRefresh: function (module, currentScreen) {
        if (['Studies', 'Claims', 'Payments'].indexOf(module) > -1 && this.setupDataUpdated) {
            this.setupDataUpdated = false;
            this.refreshAppSettings();
        }
    },

    refreshAppSettings: function (showStatus) {

        new window.AppServer(function () {
            console.log('App settings re-initialized..');
            if (showStatus) {
                commonjs.showStatus('Settings refreshed.');
            }
        });
    },

    highlightMainMenu: function (currentModule) {
    },

    initializeI18n: function () {
        var i18nAttr = '';
        $('#spScreenName').empty()
        $('#spScreenName').removeAttr('i18n');

        switch (this.currentScreen) {
            case 'Facility':
                i18nAttr = 'shared.screens.setup.facility';
                break;
            default:
                break;
        }

        if (i18nAttr != '') {
            $('#spScreenName').empty();
            $('#spScreenName').attr('i18n', i18nAttr);
        }
        $('#spScreenName').show();
        $('#divPageHeaderScreen').show();


        if (window.parent != window) {
            $('#divPageHeaderScreen').hide();
        }
    }
};
