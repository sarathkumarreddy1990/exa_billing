var layout = {

    currentModule: null,
    currentScreen: null,
    lastModule: null,
    lastScreen: null,

    initialized: false,

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

        this.highlightSideMenu(options.screen);

        if (options.layout == siteLayouts.customer)
            this.highlightMainMenu_Customer(options.screen);
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
    },

    hasInitialized: function (options) {
        return this.currentScreen == options.screen;
    },

    checkLicense: function (currentScreen, isNotFromScreen, isReadOnly) {
        return commonjs.checkScreenRight(currentScreen, isNotFromScreen, isReadOnly);
    },

    highlightSideMenu: function (currentScreen) {

    },

    highlightMainMenu: function (currentModule) {

    },

    highlightMainMenu_Customer: function (currentScreen) {

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
