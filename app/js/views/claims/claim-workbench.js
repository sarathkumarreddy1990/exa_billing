define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'shared/paper-claim',
    'collections/claim-filters',
    'text!templates/claims/claims.html',
    'text!templates/index.html',
    'models/claim-filters',
    'grid',
    'shared/fields',
    'text!templates/claims/edi-result.html',
    'text!templates/claims/ohipResult.html',
    'text!templates/claims/claim-validation.html',
    'text!templates/claims/invoice-claim.html',
    'text!templates/claims/edi-warning.html',
    'collections/app/file-management',
    'text!templates/app/ebs-list.html',
    'text!templates/app/ebs-upload.html',
    'text!templates/app/ebs-update.html',
    'text!templates/app/ebs-results.html',
    'text!templates/app/ebs-fixtures.html',
    'text!templates/app/ebs-resourceTypes.html',
    'text!templates/app/ebs-hcv-form.html',
    'text!templates/app/ebs-hcv-request.html',
    'shared/ohip',
    'views/claims/index',
    'text!templates/claims/validations.html'
],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              Pager,
              PaperClaim,
              ClaimFiltersCollection,
              ClaimHTML,
              IndexHTML,
              ModelClaimsFilters,
              ClaimsGrid,
              ListFields,
              ediResultHTML,
              ohipResultHTML,
              claimValidation,
              invoiceClaim,
              ediWarning,
              FileManagementCollection,
              EDTListHTML,
              EBSUploadHTML,
              EBSUpdateHTML,
              EBSResultsHTML,
              EBSFixturesHTML,
              EBSResourceTypesHTML,
              EbsHcvFormHTML,
              EbsHcvRequestHTML,
              ohip,
              claimsView,
              validationTemplate
          ) {

        var paperClaim = new PaperClaim();
        var paperClaimNested = new PaperClaim(true);

        var MergeQueueBase = Immutable.Record({
            'filterIndexSet': Immutable.OrderedSet(),
            /**
             * @TODO give user option to include current grid-level filter
             */
            'gridFilter': false
        });

        var navState = {
            'leftPosition': 0,
            'isMeasuring': false,
            'isScrolling': false,
            'isMerging': false,
            'mergeQueue': new MergeQueueBase(),
            'setState': function (prop, newState) {
                this[ prop ] = newState;
            },
            'getState': function (prop) {
                return this[ prop ];
            }
        };

        var edtListResults = Backbone.Collection.extend({
            url: '/exa_modules/billing/ohip/ct',
            method: 'POST',
            type: 'POST',

            parse: function(response) {
                return _.reduce(response.results, function(data, result) {
                    if (result.data) {
                        return data.concat(result.data);
                    }
                }, []);
            }
        });

        var _self = Backbone.View.extend({
            currentIdleCallback: null,
            el: null,
            pager: null,
            model: null,
            isStudyBased: true,
            isFirstTabEnabled: true,
            filterQueries: [],
            dateRangeFilterInitValue: 4,
            study_loaded: false,
            routePrefix: '',
            studiesTable: null,
            studyFilters: null,
            isAdmin: false,
            datePickerCleared: false,
            ae_titles: [],
            autorefreshInterval: 3000,
            autorefresh: false,
            statusCode: [],
            userSettings: "",
            events: {
                "click #btnClearAllStudy": "clearAllSelectedRows",
                "click #btnSelectAllStudy": "selectAllRows",
                "click #btnElectronicClaim": "createClaims",
                "click #btnPaperClaimBW": "createClaims",
                "click #btnSpecialForm": "createClaims",
                "click #btnPaperClaimRed": "createClaims",
                "click #btnInvoiceServiceDate": "createClaims",
                "click #btnInvoicePatientName": "createClaims",
                "click #btnPatientPayemnt": "createClaims",
                "click #btnClaimFormat": "createClaims",
                "click #btnValidateOrder": "validateClaim",
                "click #btnClaimRefreshAll": "refreshAllClaims",
                "click #btnValidateExport": "exportExcel",
                "click #btnClaimsRefresh": "refreshClaims",
                "click #btnClaimsCompleteRefresh": "completeRefresh",
                "click #btnEdtEbs": "showEDTConformanceTesting",
                "click #btnHcvEbs": "showHCVConformanceTesting",

            },

            initialize: function (options) {
                this.options = options;
                var self = this;


                this.edtListResults = new edtListResults();

                $document.on('studyFilter:delete', function (e, id) {
                    self.removeStudyTab(id);
                });

                $document.on('studyFilter:save', function (e, id) {
                    self.getStudyFilter(id);
                });

                $document
                    .off('keydown', self.showFilterMergeUI)
                    .on('keydown', self.showFilterMergeUI);

                $document
                    .off('keyup', self.finishFilterMerge)
                    .on('keyup', self.finishFilterMerge);

                // Don't hide for Alberta
                if (app.country_alpha_3_code === 'can' && app.province_alpha_2_code !== 'AB') {
                    commonjs.hideItem('diagnosis-count', '#aDiagnosisCountDropDownItem');
                    commonjs.hideItem('insurance-vs-lop', '#aInsuranceLOPDropDownItem');
                }
            },

            underConstruction:function(){
                alert("Under construction");
                return false;
            },

            showFilterMergeUI: function (event) {
                if (navState.getState('isMerging') === false && event.shiftKey && event.ctrlKey) {
                    navState.setState('isMerging', true);

                    /**
                     * Show markers next to merge-able filter names
                     */
//                    fastdom.mutate(function () {
//                        this.addClass('merge-pending');
//                    }.bind($('.top-nav')));
                }
            },
            completeRefresh: function (e) {
                var self = this;
                self.render(e);
            },

            render: function (queryString) {
                var self = this;
                self.hcvFormTemplate = _.template(EbsHcvFormHTML);
                self.hcvRequestTemplate = _.template(EbsHcvRequestHTML);

                self.edtListTemplate = _.template(EDTListHTML);
                self.ebsUploadTemplate = _.template(EBSUploadHTML);
                self.ebsUpdateTemplate = _.template(EBSUpdateHTML);
                self.ebsResultsTemplate = _.template(EBSResultsHTML);
                self.ebsFixturesTemplate = _.template(EBSFixturesHTML);
                self.ebsResourceTypesTemplate = _.template(EBSResourceTypesHTML);

                self.template = _.template(ClaimHTML);
                self.indexTemplate = _.template(IndexHTML);
                self.claimValidation = _.template(claimValidation);
                self.invoiceClaim = _.template(invoiceClaim);
                self.ediWarning = _.template(ediWarning);
                self.$el.html(self.indexTemplate({
                    country_alpha_3_code: app.country_alpha_3_code,
                    province_alpha_2_code: app.province_alpha_2_code,
                    billing_region_code: app.billingRegionCode,
                    showConformanceTesting: app.province_alpha_2_code === 'ON' && app.ohipConfig.showConformanceTesting,
                    gadget: '',
                    customStudyStatus: [],
                    customOrderStatus: [],
                    customStudyFlag: []
                }));

                if (queryString && !queryString.target && commonjs.getParameterByName(queryString).admin && commonjs.getParameterByName(queryString).admin == 1) {
                    self.isAdmin = true;
                }
                commonjs.showLoading('Loading filters..');
                self.userSettings = commonjs.hstoreParse(app.userInfo.user_settings);
                $("#btnStudiesRefreshAll, .createNewClaim, #btnStudiesRefresh, #btnbatchClaim, #diveHomeIndex, #divclaimsFooter").hide();
                $('#divPageLoading').show();

                self.claimsFilters = new ClaimFiltersCollection();
                self.claimsFilters.fetch({
                    data: {},
                    success: function (model, response) {
                        var claimsFilters = [];
                        claimsFilters.push({
                            assigned_users: null,
                            display_as_tab: true,
                            display_in_ddl: true,
                            filter_id: "All_Claims",
                            filter_info: null,
                            filter_name: commonjs.geti18NString("shared.fields.allClaims"),
                            i18n_name: "shared.fields.allClaims",
                            filter_order: 0,
                            id: "All_Claims"
                        });

                        if (app.country_alpha_3_code === "can") {
                            claimsFilters.push({
                                assigned_users: null,
                                display_as_tab: true,
                                display_in_ddl: true,
                                filter_id: "Files",
                                filter_info: null,
                                filter_name: commonjs.geti18NString("billing.claims.files"),
                                i18n_name: "billing.claims.files",
                                filter_order: 0,
                                id: "Files"
                            });
                        }

                        if (app.billingRegionCode === "can_AB") {
                            claimsFilters.push({
                                assigned_users: null,
                                display_as_tab: true,
                                display_in_ddl: true,
                                filter_id: "resubmission_claims",
                                filter_info: null,
                                filter_name: commonjs.geti18NString("billing.claims.canAhs.resubmissionClaims"),
                                i18n_name: "billing.claims.canAhs.resubmissionClaims",
                                filter_order: 0,
                                id: "resubmission_claims"
                            });
                        }

                        claimsFilters.push({
                            assigned_users: null,
                            display_as_tab: true,
                            display_in_ddl: true,
                            filter_id: "Follow_up_queue",
                            filter_info: null,
                            filter_name: commonjs.geti18NString("billing.fileInsurance.followupQueue"),
                            i18n_name: "billing.fileInsurance.followupQueue",
                            filter_order: 0,
                            id: "Follow_up_queue"
                        });
                        claimsFilters = claimsFilters.concat(response)
                        commonjs.claimsFilters = Immutable.List(claimsFilters);
                        self.setFiltertabs(claimsFilters);
                        // set default claim format
                        $("#btnClaimFormat").text(commonjs.geti18NString('billing.payments.electronicClaim'));
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
                if (!app.enableEmergencyAccess)
                    $('.emergencyAccess').hide();
                else
                    commonjs.blinkStat('#emergencyAccess', 1500);
            },

            bindDateRangeOnSearchBox: function (gridObj, tabtype, defaultDateFilter) {
                var self = this;
                var drpTabColumnSet = [
                    {
                        forTab: "claims",
                        columns: ["current_illness_date", "claim_dt", "followup_date", "birth_date", 'submitted_dt', 'first_statement_dt', 'created_dt', 'updated_date_time']
                    }
                ];
                var columnsToBind = _.find(drpTabColumnSet, function (val) {
                    return val.forTab === tabtype;
                }).columns;
                var drpOptions = { locale: { format: "L" } };

                var currentFilter = self.getFilterObject(commonjs.currentStudyFilter);
                _.each(columnsToBind, function (col) {
                    var rangeSetName = "past";
                    if (col === "scheduled_dt") {
                        rangeSetName = "future";
                    }
                    if (col === "birth_date") {
                        rangeSetName = "dob";
                    }
                    // binding will register default events that will handle formatting
                    // those events will (according to jQuery) fire before any others defined afterwards
                    // to examine events attached to an element use:
                    //      $._data($("#gs_scheduled_dt")[0], "events");
                    //
                    // because ids for columns are not unique, we have to bind using jQuery object and filter id as selector
                    // all columns start with "gs_" and are several levels under "gview_tblClaimGrid{filterId}"
                    var colSelector = "#gview_tblClaimGrid" + gridObj.options.filterid + " " + "#gs_" + col;
                    var colElement = $(colSelector);
                    if (!colElement.length) {
                        return; // skips current iteration only !
                    }


                    if ((!self.datePickerCleared && defaultDateFilter === 'claim_dt' && col == 'claim_dt'
                        && (gridObj.options.filterid == 'All_Claims' || gridObj.options.filterid === "Follow_up_queue" || gridObj.options.filterid === "Files"))
                        && !colElement.val()) {
                        var toDate = moment(),
                            fromDate = moment().subtract(89, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

                    commonjs.bindDateRangePicker(colElement, drpOptions, rangeSetName, function (start, end) {
                        if (start && end) {
                            currentFilter.dateString = start.format('LL') + ' - ' + end.format('LL');
                            currentFilter.startDate = start.format('L');
                            currentFilter.endDate = end.format('L');
                            $('input[name=daterangepicker_start]').removeAttr("disabled");
                            $('input[name=daterangepicker_end]').removeAttr("disabled");
                            $('.ranges ul li').each(function (i) {
                                if ($(this).hasClass('active')) {
                                    currentFilter.rangeIndex = i;
                                }
                            });
                        }

                    });
                    // additional events that will trigger refreshes
                    colElement.on("apply.daterangepicker", function () {
                        self.refreshClaims(true);
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.datePickerCleared = true;
                        self.refreshClaims(true);
                    });
                    commonjs.isMaskValidate();
                }); // end _.each
            },

            createClaims: function (e, isFromReclaim) {
                if ($('#btnClaimFormat').attr("data-disabled") === "disabled") {
                    return false;
                }

                var self = this;
                var billingMethodFormat = '';
                var filterID = commonjs.currentStudyFilter;
                var filter = commonjs.loadedStudyFilters.get(filterID);
                var existingRenderingProvider = null;
                var selectedClaimsRows = $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked');
                var billingMethod = $(e.target).attr('data-method');

                if (app.billingRegionCode == 'can_ON' && billingMethod == 'electronic_billing') {
                    for (var i = 0; i < selectedClaimsRows.length; i++) {
                        var rowId = selectedClaimsRows[i].parentNode.parentNode.id;
                        var renderingProvider = self.getGridCellData(filter, rowId, 'rendering_provider');

                        if (!existingRenderingProvider) {
                            existingRenderingProvider = renderingProvider;
                        }

                        if (renderingProvider != existingRenderingProvider) {
                            return commonjs.showWarning('messages.status.multipleRenderingProviders');
                        }
                    }
                }

                if (e.target) {
                    if ($(e.target).closest('li') && $(e.target).closest('li').hasClass('disabled')) {
                        return false;
                    }
                    var claimFormat = $(e.target).attr('data-value');
                    billingMethodFormat = $(e.target).attr('data-method');
                    if (claimFormat) {

                        if (billingMethodFormat == 'paper_claim') {
                            localStorage.setItem('default_paperclaim_format', $(e.target).attr('data-format'));
                            localStorage.setItem('default_paperclaim', $(e.target).attr('data-value'));
                            $("#btnClaimFormat").attr('data-format', $(e.target).attr('data-format'));

                        }

                        if (billingMethodFormat == 'direct_billing') {
                            localStorage.setItem('default_directbilling_format', $(e.target).attr('data-format'));
                            localStorage.setItem('default_directbilling', $(e.target).attr('data-value'));
                            $("#btnClaimFormat").attr('data-format', $(e.target).attr('data-format'));
                        }


                        $("#btnClaimFormat").attr('data-method', billingMethodFormat);

                        $("#btnClaimFormat").text(claimFormat)
                    }
                }

                filterID = commonjs.currentStudyFilter;
                filter = commonjs.loadedStudyFilters.get(filterID);

                var claimIds = [];
                var invoiceNo = [];
                var existingBillingMethod = '';
                var existingClearingHouse = '';
                var selectedPayerName = [];

                var isCheckedAll = $('#chkStudyHeader_' + filterID).prop('checked');
                var data = {};
                var gridElement = $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked');
                var isWCBBilling = false;

                if (!gridElement.length) {
                    return commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                }

                if (isCheckedAll && billingMethodFormat === 'electronic_billing') {
                    var filterData = JSON.stringify(filter.pager.get('FilterData'));
                    var filterCol = JSON.stringify(filter.pager.get('FilterCol'));

                    var isDatePickerClear = filterCol.indexOf('claim_dt') === -1;

                    data = {
                        filterData: filterData,
                        filterCol: filterCol,
                        sortField: filter.pager.get('SortField'),
                        sortOrder: filter.pager.get('SortOrder'),
                        pageNo: 1,
                        pageSize: 1000,
                        company_id: app.companyID,
                        user_id: app.userID,
                        isDatePickerClear: isDatePickerClear,
                        customArgs: {
                            filter_id: filterID,
                            isClaimGrid: true
                        },
                        isAllClaims: true,
                        companyCode: app.company.company_code || "",
                        billingRegionCode:app.billingRegionCode
                    }
                } else {
                    var insuranceProviders = [];
                    var insuranceProviderCodes = [];

                    /* eslint-disable no-redeclare */
                    for (var i = 0; i < gridElement.length; i++) {
                        var rowId = gridElement[i].parentNode.parentNode.id;
                        var claimStatus = self.getGridCellData(filter, rowId, 'hidden_claim_status_code');
                        var insProvider = self.getGridCellData(filter, rowId, 'hidden_insurance_providers');
                        var insProviderCode = self.getGridCellData(filter, rowId, 'hidden_insurance_provider_codes');

                        if (insProvider) {
                            insuranceProviders.push(insProvider);
                            insuranceProviderCodes.push(insProviderCode);
                        }

                        if (app.billingRegionCode === 'can_AB') {

                            // Restrict to submit same type of insurance providers
                            var uniqInsProviders = _.uniq(insuranceProviderCodes) || [];

                            if (billingMethodFormat === 'electronic_billing' && uniqInsProviders.length > 1) {
                                return commonjs.showWarning('messages.warning.claims.multipleInsurancesForSubmission');
                            }

                            isWCBBilling = uniqInsProviders.length === 1 && uniqInsProviders[0] === 'WCB';
                        }

                        if (claimStatus === "PV") {
                            commonjs.showWarning('messages.status.pleaseValidateClaims');
                            return false;
                        }

                        switch (app.billingRegionCode) {
                            case 'can_AB': {
                                /* Allowed to submit electronic claim when claim is in paid in full/partial/at 0 statuses.
                                   claim was restricted to submit when status of claim is in any of the below:
                                   ADP - AHS Delete Pending
                                   AD  - AHS Deleted
                                   PA  - Pending Acknowledgement
                                   R   - Rejected
                                   D   - Denied */

                                var excludeClaimStatus = ['PA', 'ADP', 'AD', 'R', 'D'];

                                if (excludeClaimStatus.indexOf(claimStatus) > -1 || (isWCBBilling && claimStatus != 'PS')) {
                                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsStatus');
                                    return false;
                                }
                                break;
                            }
                            case 'can_MB': {
                                if (claimStatus != 'PS') {
                                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsStatus');
                                    return false;
                                }
                                break;
                            }
                            case 'can_BC': {
                                /* Allowed to submit electronic claim when status of claim is in any of the below:
                                   SF - Submission failed
                                   PS  - Pending submission
                                */

                                var excludeClaimStatus = ['SF', 'PS'];

                                if (excludeClaimStatus.indexOf(claimStatus) === -1) {
                                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsStatus');
                                    return false;
                                }
                                break;
                            }
                        }

                        var billingMethod = self.getGridCellData(filter, rowId, 'hidden_billing_method');

                        var rowData = $(filter.options.gridelementid).jqGrid('getRowData', rowId);
                        var claimDt = moment(rowData.claim_dt).format('L');
                        var futureClaim = claimDt && moment(claimDt).diff(moment(), 'days');

                        if (e.target) {
                            if ((billingMethodFormat != "special_form" && billingMethodFormat !== billingMethod)
                                || (billingMethodFormat === 'special_form' && billingMethod === 'electronic_billing')) {
                                commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                                return false;
                            }
                        }

                        if (app.country_alpha_3_code === "can" && futureClaim > 0 && billingMethodFormat === 'electronic_billing') {
                            commonjs.showWarning('messages.status.futureClaimWarning');
                            return false;
                        }

                        if (existingBillingMethod === '') existingBillingMethod = billingMethod;
                        if (existingBillingMethod !== billingMethod && billingMethodFormat != "special_form") {
                            commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                            return false;
                        }
                        existingBillingMethod = billingMethod;


                        var clearingHouse =  self.getGridCellData(filter, rowId, 'hidden_clearing_house');
                        if (existingClearingHouse === '') existingClearingHouse = clearingHouse;
                        if (app.country_alpha_3_code !== "can" && existingClearingHouse !== clearingHouse && billingMethod === 'electronic_billing') {
                            commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfClearingHouseClaims');
                            return false;
                        }
                        existingClearingHouse = clearingHouse;


                        var payerName = self.getGridCellData(filter, rowId, 'hidden_payer_name');
                        selectedPayerName.push(payerName)

                        var invoice_no = self.getGridCellData(filter, rowId, 'hidden_invoice_no');
                        invoiceNo.push(invoice_no);
                        claimIds.push(rowId);
                    }
                    /* eslint-enable no-redeclare */

                    data = {
                        claimIds: claimIds.toString(),
                        isWCBBilling: isWCBBilling,
                        userId: app.userID,
                        companyCode: app.company.company_code || ""
                    }
                    if (billingMethodFormat === "special_form") {
                        if (insuranceProviders.length === gridElement.length) {
                            paperClaim.print('special_form', claimIds, false);
                            return;
                        }
                        commonjs.showWarning(gridElement.length === 1 ? 'messages.status.pleaseSelectClaimHavingInsurance' : 'messages.status.pleaseSelectClaimsHavingInsurance');
                        return false;

                    }

                    if (existingBillingMethod === 'paper_claim') {
                        var paperClaimFormat =
                            localStorage.getItem('default_paperclaim_format') === 'ORIGINAL' ?
                            'paper_claim_original' : 'paper_claim_full';

                        paperClaim.print(paperClaimFormat, claimIds, false);
                        return;
                    }

                    var sortBy = '';
                    if (e.target) {
                        if (e.target.innerHTML.indexOf('Patient Name') > -1) {
                            sortBy = 'patient_name';
                        } else if (e.target.innerHTML.indexOf('Service Date') > -1) {
                            sortBy = 'service_date';
                        }
                    }
                    var uniquePayerName = _.uniq(selectedPayerName);

                    if (existingBillingMethod === 'direct_billing') {
                        if (uniquePayerName && uniquePayerName.length && uniquePayerName.length > 1) {
                            self.printInvoiceClaim('direct_invoice', claimIds, sortBy)
                            return;
                        } else if (invoiceNo && invoiceNo[0] && invoiceNo[0].length > 0) {
                            paperClaim.print('direct_invoice', claimIds, false, {
                                sortBy: sortBy,
                                invoiceNo: invoiceNo[0]
                            });
                            return;
                        }
                        paperClaim.print('direct_invoice', claimIds, false, {
                            sortBy: sortBy,
                            invoiceNo: invoiceNo[0]
                        });
                        return;

                    }

                    if (existingBillingMethod === 'patient_payment') {
                        paperClaim.print('patient_invoice', claimIds, false, {
                            sortBy: 'patient_name'
                        });
                        return;
                    }
                }

                $('#btnClaimFormat').attr('data-disabled', "disabled");
                commonjs.showLoading();

                var url = self.getSubmitClaimUrl(app.billingRegionCode, isWCBBilling);

                if (app.billingRegionCode === 'can_AB') {
                    data.source = 'submit';
                }

                jQuery.ajax({
                    url: url,
                    type: "POST",
                    data: data,
                    success: function (data) {
                        commonjs.hideLoading();
                        isWCBBilling = isWCBBilling || (data && data.isWCBBilling);
                        data.removeDisabledFlag = true;

                        switch (app.billingRegionCode) {
                            case 'can_AB':
                                !isWCBBilling
                                    ? self.ahsResponse(data)
                                    : self.wcbResponse(data);
                                break;
                            case 'can_MB':
                                self.mhsResponse(data);
                                break;
                            case 'can_ON':
                                self.ohipResponse(data);
                                break;
                            case 'can_BC':
                                self.bcResponse(data, isFromReclaim);
                                break;
                            default:
                                self.ediResponse(data, isFromReclaim);
                        }

                        if (data.removeDisabledFlag) {
                            $('#btnClaimFormat').removeAttr("data-disabled");
                        }
                    },
                    error: function (err) {
                        $('#btnClaimFormat').removeAttr("data-disabled");
                        commonjs.handleXhrError(err);
                    }
                });
            },

            selectAllClaim: function (filter, filterID, targetType) {
                var self = this;
                var filterData = JSON.stringify(filter.pager.get('FilterData'));
                var filterCol = JSON.stringify(filter.pager.get('FilterCol'));

                var isDatePickerClear = filterCol.indexOf('claim_dt') === -1;

                var isCanada = app.country_alpha_3_code === 'can';
                var implUrl = '/exa_modules/billing/claim_workbench';
                if (isCanada) {
                    implUrl = '/exa_modules/billing/ohip/submitClaims';
                }
                jQuery.ajax({
                    url: implUrl,
                    type: "post",
                    data: {
                        "filterData": filterData,
                        "filterCol": filterCol,
                        "sortField": filter.pager.get('SortField'),
                        "sortOrder": filter.pager.get('SortOrder'),
                        pageNo: 1,
                        pageSize: 1000,
                        targetType: targetType,
                        isDatePickerClear: isDatePickerClear,
                        customArgs: {
                            filter_id: filterID,
                            isClaimGrid: true
                        },
                        userId: app.userID
                    },
                    success: function (data) {
                        commonjs.hideLoading();
                        if (isCanada) {
                            self.ohipResponse(data);
                        }
                        else if (targetType == 'EDI') {
                            self.ediResponse(data);
                        } else {
                            if (!data.invalidClaim_data.length) {
                                commonjs.showStatus("messages.status.validatedSuccessfully");
                                $("#btnClaimsRefresh").click();
                            }
                            else
                                commonjs.showDialog({ header: 'Validation Results', i18nHeader: 'billing.claims.validationResults', width: '70%', height: '60%', html: self.claimValidation({ response_data: data.invalidClaim_data }) });
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);

                    }
                });
            },

            ohipResponse: function(data) {
                var errData = null;

                if (data.results && data.results.length && !data.error && !data.faults) {
                    return commonjs.showStatus('Claims submitted successfully');
                }

                if (data && data.isInvalidBillingMethod) {
                    return commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                } else if (data.validationMessages && data.validationMessages.length) {
                    errData = data.validationMessages;
                } else if (data.error && data.error.length) {
                    errData = {
                        error: data.error,
                        content: data.results,
                        faults: data.faults
                    }
                }

                var errorContent = '<div style="width:100%;height:100%" id="divError"><textarea style="width:100%;height:100%" id="txtAreaErrorData">' + JSON.stringify(errData, undefined, 4) + '</textarea></div>';
                data.removeDisabledFlag = false;

                commonjs.showDialog({
                    header: 'OHIP  Submission Error',
                    i18nHeader: 'shared.moduleheader.ohipClaims',
                    width: '50%',
                    height: '50%',
                    html: errorContent,
                    onHide: function () {
                        $('#btnClaimFormat').removeAttr("data-disabled");
                    }
                });
            },

            ahsResponse: function (data) {
                data.err = data && (data.err || data[0]);

                if (data && data.isInvalidBillingMethod) {
                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                } else if (data && data.isMultipleInsurances) {
                    commonjs.showWarning('messages.warning.claims.multipleInsurancesForSubmission');
                } else if (data && data.isFolderNotExists) {
                    commonjs.showWarning('messages.warning.claims.ahsFolderNotFound');
                } else if (data && data.isConnectionFailed) {
                    commonjs.showWarning('messages.warning.claims.ahsConnectionFailed');
                } else if (data.validationMessages && data.validationMessages.length) {
                    var responseTemplate = _.template(validationTemplate);
                    data.removeDisabledFlag = false;

                    // To show array of validation messages
                    commonjs.showNestedDialog({
                        header: 'Claim Validation Result',
                        i18nHeader: 'billing.claims.claimValidationResponse',
                        height: '50%',
                        width: '60%',
                        html: responseTemplate({
                            'validationMessages': data.validationMessages
                        }),
                        onHide: function () {
                            $('#btnClaimFormat').removeAttr("data-disabled");
                        }
                    });
                } else if (data.err) {
                    commonjs.showWarning(data.err);
                } else {
                    commonjs.showStatus('messages.status.claimSubmitted');
                    this.refreshClaims(true);
                }
            },

            ediResponse: function (data, isFromReclaim) {
                var self = this;
                self.ediResultTemplate = _.template(ediResultHTML);
                self.ohipResultTemplate = _.template(ohipResultHTML);

                commonjs.showLoading();

                commonjs.hideLoading();
                data.err = data.err || data.message;

                if (data && data.isInvalidBillingMethod) {
                   return commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                } else if (data && data.err) {
                    commonjs.showWarning(data.err);
                }

                if (data && data.ediText && data.ediText.length) {
                    commonjs.previousValidationResults = { isFromEDI: true, result: $.extend(true, {}, data) };

                    var segmentValidations = data.ediTextWithValidations
                        .filter(function (segmentData) {
                            return typeof segmentData !== 'string' && segmentData.v;
                        })
                        .map(function (segmentData) {
                            return segmentData.v;
                        }).reduce(function (result, item) {
                            return result.concat(item);
                        }, []);


                    data.validations = data.validations.concat(segmentValidations);
                    var result = [];
                    var validations = [];
                    var commonErrorValidation = [];

                    data.validations.forEach(function (object) {

                        if (_.has(object, "dataID")) {
                            validations.push(object);
                        } else {
                            commonErrorValidation.push(object);
                        }
                    });

                    if (data.validations && data.validations.length && validations.length) {
                        result = _.groupBy(validations, "dataID");
                    }

                    data.ediTextWithValidations = data.ediTextWithValidations.map(function (val) {
                        return typeof val === 'string' ? val.replace("undefined", "") : val;
                    })

                    self.ediTemplateRender(isFromReclaim, result, data.ediTextWithValidations, commonErrorValidation, data);
                    $(".popoverWarning").popover();

                    if (data.validations && data.validations.length == 0) {
                        $("#btnClaimsRefresh").click();
                        $('#liEDI, #aEDIResp').addClass('active');
                        $('#reclaimEDI, #liErrorMessages').hide();
                        $('#aDownloadEDI').show();
                    } else {
                        $('#divEDIResult, #aDownloadEDI').hide();
                        $('#reclaimEDI, #divErrorMsgs').show();
                    }

                    commonjs.initializeScreen({ buttons: [] });
                    $('#tabsEDIResponses li').click(function (e) {
                        if (e.target.id == 'aEDIResp') {
                            $('#liEDI').addClass('active');
                            $('#liErrorMessages').removeClass('active');
                            $('#divErrorMsgs').hide();
                            $('#divEDIResult').show();
                            if (data.validations && data.validations.length == 0) {
                                $('#aDownloadEDI').show();
                            }
                        } else {
                            $('#liEDI,#aEDIResp').removeClass('active');
                            $('#liErrorMessages').addClass('active');
                            $('#divErrorMsgs').show();
                            $('#aDownloadEDI, #divEDIResult').hide();
                        }
                    });

                    $('#modal_div_container .downloadEDI').on('click', function () {
                        var element = document.createElement('a');
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data.ediText));
                        element.setAttribute('download', 'edi' + (data.ediFileExtension || '.txt'));

                        element.style.display = 'none';
                        document.body.appendChild(element);

                        element.click();

                        document.body.removeChild(element);
                        $('#modal_div_container .downloadEDI').on('click', function () {
                            self.downloadClaimSubmission(data.ediText, 'edi' + (data.ediFileExtension || '.txt'), 'utf-8');
                        });
                    });
                } else if (data && data.ohipText && data.ohipText.length) {
                    var str = data.ohipText.replace(/\r/g, '<br/>').replace('\x1A', '');

                    commonjs.showDialog({
                        header: 'OHIP Claim',
                        i18nHeader:'shared.moduleheader.ohipClaims',
                        width: '95%',
                        height: '75%',
                        html: self.ohipResultTemplate()
                    });
                    $('#divOHIPResp').append(str);
                    $('#modal_div_container .downloadOHIP').on('click', function () {
                        self.downloadClaimSubmission(data.ohipText, data.ohipFilename, 'acsii');
                    });
                }
                else {
                    commonjs.showWarning('NO_DATA');
                }

            },

            wcbResponse: function (data) {
                var self = this;
                data.err = data.err || data.message;

                var errorDetails = data.validationMessages || data.submissionErrors;

                if (errorDetails && errorDetails.length) {
                    var responseTemplate = _.template(validationTemplate);
                    data.removeDisabledFlag = false;

                    commonjs.showNestedDialog({
                        header: 'Claim Validation Result',
                        i18nHeader: 'billing.claims.claimValidationResponse',
                        height: '50%',
                        width: '60%',
                        html: responseTemplate({
                            'validationMessages': errorDetails
                        }),
                        onHide: function () {
                            $('#btnClaimFormat').removeAttr("data-disabled");
                        }
                    });
                } else if (data.err) {
                    commonjs.showWarning(data.err);
                } else if (data.fileContent) {
                    commonjs.showStatus('messages.status.claimSubmitted');
                    self.downloadClaimSubmission(data.fileContent, data.fileName, 'base64', 'application/zip');
                }
            },

            downloadClaimSubmission: function(fileText, fileName, encoding, type) {
                var element = document.createElement('a');
                var downloadType = type || 'text/plain;charset=';
                element.setAttribute('href', 'data:' + downloadType + ';' + encoding + ',' + encodeURIComponent(fileText));
                element.setAttribute('download', fileName);

                element.style.display = 'none';
                document.body.appendChild(element);

                element.click();

                document.body.removeChild(element);
            },

            printInvoiceClaim: function (invoice_type, claimIds, sortBy) {
                var self = this;
                var printerClaimids = [];

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/invoice_claims',
                    type: 'GET',
                    data: {
                        claimIDs: claimIds
                    },
                    success: function(data){
                        if (data) {
                            commonjs.hideLoading();

                            if (data && data.length) {
                                commonjs.showDialog({ header: 'Invoice Claim', i18nHeader: 'billing.fileInsurance.invoiceClaim', width: '60%', height: '40%', html: self.invoiceClaim({ response_data: data }) });

                                $(".spnInvoicePrint").click(function (e) {
                                    $(e.target).removeClass("icon-ic-print");
                                    $(e.target).text("Printed").css({ fontSize: "14px" })
                                    var ele = (e.target.id).split('_');
                                    printerClaimids = [];

                                    _.each(ele, function (claimid) {
                                        if (claimid != 'spnInvoicePrint') {
                                            printerClaimids.push(parseInt(claimid));
                                        }
                                    });

                                    paperClaimNested.print(invoice_type, printerClaimids, false, {
                                        sortBy: sortBy
                                    });
                                });
                            }
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            setFiltertabs: function (filters) {
                var self = this;
                commonjs.showLoading('Fetching data..');
                commonjs.setFilter(null, null);
                $('#divTabsContainer').show();

                // cache jQuery objects
                var $divTabsContainer = $(document.getElementById('divTabsContainer'));
                var $claimsTabs = $divTabsContainer.find('#claimsTabs');
                var $ulTabCollection = $(document.getElementById('ulTabCollection'));
                var $dataContainer = $(document.getElementById('data_container_home'));
                var $divFiltersContainer = $(document.getElementById('divFiltersContainer'));
                var $divFilterRangeHTML = $(document.getElementById('divFilterRange')).find('span').html();
                var $divPager = $(document.getElementById('divPager'));
                var $btnTabNavLeftIcon = $(document.getElementById('btnTabNavLeft'));
                var $btnTabNavRightIcon = $(document.getElementById('btnTabNavRight'));
                var $btnTabNavLeft = $btnTabNavLeftIcon.parent();
                var $btnTabNavRight = $btnTabNavRightIcon.parent();
                var $inputs = $('input');
                var dateRangePickerStart = $.trim($inputs.filter('[name="daterangepicker_start"]').val());
                var dateRangePickerEnd = $.trim($inputs.filter('[name="daterangepicker_end"]').val());

                var setupElements = function () {

                    var finishSetup = function () {
                        var cookie = (commonjs.getCookieOptions(5) || '').split(/__/);
                        var id = cookie[ 0 ];

                        var $claimsTabsItems = $claimsTabs.children('li');
                        var $claimsTabTarget = $claimsTabsItems.eq(0);
                        var $link;

                        if (app.default_claim_tab) {
                            $link = $claimsTabs.children('#liclaimsTab' + app.default_claim_tab);
                            if ($link.length > 0) {
                                // Default tab targeted - go there
                                $claimsTabTarget = $link;
                            }
                        }
                        if (( typeof $link === 'undefined' || $link.length === 0 ) && id.length > 0) {
                            // Otherwise use cookie
                            $link = $claimsTabs.children('#liclaimsTab' + id);
                            if ($link.length > 0) {
                                $claimsTabTarget = $link;
                            }
                        }
                        $claimsTabTarget.children('a').click();

                    }.bind(null, navState);

                    var setClickEvents = function (navState, callback) {
                        commonjs.hideLoading();
                        var $pagination = $divPager.find('.pagination');
                        var $claimsTabsItems = $claimsTabs.children('li');
                        var $claimsTabsLinks = $claimsTabsItems.children('a');
                        $ulTabCollection.on('click', 'li', function (e) {
                            var target = e.currentTarget;
                            var $target = $(target);
                            var dataContainerValue = target.getAttribute('data-container');
                            var $claimsTabsItems = $claimsTabs.children('li');
                            var $claimsTabsLinks = $claimsTabsItems.children('a');
                            var $link = $claimsTabsLinks.filter('[data-container="' + dataContainerValue + '"]');

                            if ($target.hasClass('can-merge') && navState.getState('isMerging') === true) {
                                e.preventDefault();
                                e.stopPropagation();

                                return false;
                            }

                            switch (dataContainerValue) {
                                case 'SU':
                                    $link.click();
                                    break;
                                default:
                                    var studyTabID = '[href="#divClaimGridContainer' + dataContainerValue + '"]';
                                    var $targetStudyTab = $claimsTabsLinks.filter(studyTabID);
                                    if ($targetStudyTab.length > 0) {
                                        //$targetStudyTab.show();
                                        $targetStudyTab.click();
                                    }
                                    break;
                            }
                        });

                        $claimsTabsLinks.on("click", function (e) {
                            var target = e.currentTarget;
                            var $target = $(target);
                            var $tab = $target.parent();
                            var dataContainerValue = target.getAttribute('data-container');
                            var $claimsTabsItems = $claimsTabs.children('li');
                            var $claimsTabsLinks = $claimsTabsItems.children('a');
                            var $ulTabItems = $ulTabCollection.children('li');

                            if ($tab.hasClass('can-merge') && navState.getState('isMerging') === true) {
                                e.preventDefault();
                                e.stopPropagation();

                                return false;
                            }

                            homeOpentab = dataContainerValue;
                            app.homeOpentab = dataContainerValue;

                            commonjs.nextRowID = 0;
                            commonjs.previousRowID = 0;
                            commonjs.currentGridID = '';
                            commonjs.setCookieOptions(5, dataContainerValue + '__' + (new Date()).getTime());
                            $claimsTabsLinks.css('border-top', '');
                            $claimsTabsItems.css('margin-bottom', '');
                            if (dataContainerValue) {
                                self.toggleTabContents(dataContainerValue);
                                var claimsTabID = '[href="#divClaimGridContainer' + dataContainerValue + '"]';
                                var $claimsTabTarget = $claimsTabsLinks.filter(claimsTabID);
                                var borderWidth = '3px !important';
                                if ($claimsTabTarget.length > 0 && $claimsTabTarget.attr('style') && /background/.test($claimsTabTarget.attr('style'))) {
                                    $claimsTabTarget
                                        .css({
                                            'border-top-width': borderWidth,
                                            'border-top-color': $claimsTabTarget[ 0 ].style.backgroundColor + ' !important'
                                        })
                                        .closest('li')
                                        .css('margin-bottom', '-' + borderWidth);
                                }
                            }
                            if ($claimsTabTarget) {
                                var isDicomSearch = $claimsTabTarget.attr('data-showDicom') === "true";
                                var isRisOrderSearch = $claimsTabTarget.attr('data-showRisOrder') === "true";
                                var showEncOnly = $claimsTabTarget.attr('data-showEncOnly') === "true";
                            }

                            self.setTabContents(dataContainerValue, false, isDicomSearch, isRisOrderSearch, showEncOnly);

                            var $uiJQHTableKids = $('.ui-jqgrid-htable').children().children();
                            $ulTabItems.filter('[data-container="' + dataContainerValue + '"]').addClass("active"); // Add Tab Collection active highlight
                            $claimsTabsItems.removeClass("active");
                            $("#liclaimsTab"+dataContainerValue).addClass("active");
                            $('#tblClaimGrid' + dataContainerValue).first().children().first().addClass('dg-body');
                            $uiJQHTableKids.first().height('40px');
                            $uiJQHTableKids.last().css('line-height', '2');

                           fastdom.measure(function () {
                               if ( this.getState('isScrolling') === true || this.getState('isMeasuring') === true ) {
                                   return;
                               }
                               this.setState('isMeasuring', true);

                               commonjs.docResize();
                               this.setState('isMeasuring', false);
                           }.bind(navState));

                            // SMH Bug #2606 - Hides icons if necessary when setting up the table.
                            // setTimeout(function () {
                            //     commonjs.toggleGridlistColumns();
                            // }, 10);
                        });

                        $pagination.on("click", "a", function (e) {
                            if (!/disabled/.test(e.currentTarget.parentNode.className)) {
                                $(document.getElementById('chkclaimsHeader_' + commonjs.currentclaimsFilter)).prop('checked', false);
                                self.navigateRecords(commonjs.currentclaimsFilter, e.currentTarget.getAttribute('data-container'));
                            }
                        });

                        // Sort of stolen from line 158 of public/javascripts/views/patient/home.js
                        var getPosition = function ($navMenu, nPos) {
                            Array.prototype.some.call($navMenu.children('li:visible'), function (el) {
                                var left = parseInt($(el).position().left);
                                if (-left < nPos) {
                                    nPos = -left - 20;  // Add 20px adjustment to guarantee the first item appearance in full
                                    return true;
                                }
                            });
                            return nPos;
                        };

                        $btnTabNavLeft.off('click').on('click', function (navState, event) {
                            //self.underConstruction();
                            if (navState.getState('isScrolling') === true || navState.getState('isMeasuring') === true) {
                                return;
                            }
                            navState.setState('isMeasuring', true);
                            event.stopPropagation();


                            fastdom.measure(function (navState) {
                                if (navState.getState('isScrolling') === true) {
                                    return;
                                }

                                var visible = $divTabsContainer.width();
                                // var currPos = $claimsTabs.position().left;
                                var currPos = navState.getState('leftPosition');
                                var remains = -currPos;
                                var nextPos = getPosition($claimsTabs, currPos + visible * 0.8);
                                var css = {
                                    'opacity': 1.0,
                                    'pointerEvents': 'auto'
                                };
                                if (remains < visible * 0.9) {
                                    nextPos = 0;
                                    css.opacity = 0.3;
                                    css.pointerEvents = 'none';
                                }

                                navState.setState('isMeasuring', false);
                                navState.setState('isScrolling', true);

                                fastdom.mutate(function (navState, css, nextPos) {
                                    if (navState.getState('isMeasuring') === true) {
                                        return;
                                    }

                                    $btnTabNavRight.css({
                                        'opacity': 1.0,
                                        'pointerEvents': 'auto'
                                    });
                                    $btnTabNavLeft.css(css);

                                    $claimsTabs.css({
                                        'transform': 'translateX(' + nextPos + 'px)'
                                    });

                                    navState.setState('leftPosition', nextPos);
                                    navState.setState('isScrolling', false);

                                }.bind(null, navState, css, nextPos));
                            }.bind(null, navState));
                        }.bind(null, navState));

                        /*
                         .css({ // Not gonna scroll left when it starts there already.
                         'opacity': 0.3,
                         'pointerEvents': 'none'
                         });
                         */

                        $btnTabNavRight.off('click').on('click', function (navState, event) {
                            //self.underConstruction();
                            if (navState.getState('isScrolling') === true || navState.getState('isMeasuring') === true) {
                                return;
                            }
                            event.stopPropagation();

                            navState.setState('isMeasuring', true);

                            fastdom.measure(function (navState) {
                                if (navState.getState('isScrolling') === true) {
                                    return;
                                }

                                // get the width of the UL to fix an IE rendering bug
                                var ulWidth = 0;
                                $claimsTabs.children('li').each(function () {
                                    ulWidth += $(this).outerWidth();
                                });

                                var visible = $divTabsContainer.width();
                                // var currPos = $claimsTabs.position().left;
                                var currPos = navState.getState('leftPosition');
                                var nextPos = getPosition($claimsTabs, currPos - visible * 0.8);
                                var remains = ulWidth + nextPos;
                                var css = {
                                    'opacity': 1,
                                    'pointerEvents': 'auto'
                                };
                                if (remains < visible * 0.9) {
                                    nextPos = visible * 0.98 - ulWidth;
                                    css.opacity = 0.3;
                                    css.pointerEvents = 'none';
                                }

                                navState.setState('isMeasuring', false);
                                navState.setState('isScrolling', true);

                                fastdom.mutate(function (navState, css, nextPos) {
                                    if (navState.getState('isMeasuring') === true) {
                                        return;
                                    }

                                    $btnTabNavLeft.css({
                                        'opacity': 1,
                                        'pointerEvents': 'auto'
                                    });
                                    $btnTabNavRight.css(css);

                                    $claimsTabs.css({
                                        'transform': 'translateX(' + nextPos + 'px)'
                                    });

                                    navState.setState('leftPosition', nextPos);
                                    navState.setState('isScrolling', false);

                                }.bind(null, navState, css, nextPos));
                            }.bind(null, navState));
                        }.bind(null, navState));

                        if (typeof callback === 'function') {
                            return callback();
                        }
                    }.bind(null, navState);

                    return setClickEvents(finishSetup);

                };

                var setTabStudies = function (elements, callback) {

                    self.filterQueries = elements.filterQueries.slice(0);
                    $dataContainer.html(elements.dataContainer.join(''));
                    $claimsTabs.html(elements.claimsTabs.join(''));
                    $ulTabCollection.html(elements.ulTabCollection.join(''));

                    if (typeof callback === 'function') {
                        return callback();
                    }

                };

                var filterTabInit = function (filters, callback) {
                    $divFiltersContainer.hide();

                    var processFilters = function (arrays, data) {
                        var id = data.filter_id;
                        var name = data.filter_name;
                        var i18nName = data.i18n_name;
                        var info = data.filter_info;
                        var liclaimsTab = [
                            '<li id="liclaimsTab',
                            id,
                            '"',
                            (!data.display_as_tab ?
                                ' style="display:none"' :
                                ''),
                            //' class="nav-item',
                            (info ? ' can-merge' : ''),
                            '"><a href="#divClaimGridContainer',
                            id,
                            '" data-container="',
                            id,
                            '"class="nav-link"',
                            '" data-toggle="tab" title="',
                            name,
                            (i18nName ? '" i18n="' + i18nName + '" i18nt="' + i18nName : ''),
                            '">',
                            name,
                            '</a></li>'
                        ].join('');

                        var liTab = [
                            '<li class="text-left filter-ddl-tab',
                            (info ? ' can-merge' : ''),
                            '" ',
                            ( !data.display_in_ddl ?
                                'style="display:none;" ' :
                                '' ),
                            'data-container="',
                            id,
                            '" ><a title="',
                            name,
                            '">',
                            name,
                            '</a></li>'
                        ].join('');


                        arrays.filterQueries.push({
                            filterid: id,
                            rangeIndex: self.dateRangeFilterInitValue,
                            dateString: $divFilterRangeHTML,
                            startDate: dateRangePickerStart,
                            endDate: dateRangePickerEnd
                        });
                        var templateHTML = self.template({
                            filterID: id
                        });
                        arrays.dataContainer.push(
                            templateHTML
                        );
                        arrays.claimsTabs.push(liclaimsTab);
                        arrays.ulTabCollection.push(liTab);
                        return arrays;
                    };

                    var initialTabs = function () {
                        var filterQueries = [];
                        var dataContainer = [];
                        var claimsTabs = [];
                        var ulTabCollection = [];


                        return {
                            filterQueries: filterQueries,
                            dataContainer: dataContainer,
                            claimsTabs: claimsTabs,
                            ulTabCollection: ulTabCollection
                        };
                    };

                    var elements = filters.reduce(processFilters, initialTabs());

                    if (typeof callback === 'function') {
                        return callback(elements, setupElements);
                    }

                };

                return filterTabInit(filters, setTabStudies);
            },
            setTabContents: function (filterID) {
                var self = this;
                self.datePickerCleared = false // to bind the date by default(three months) -- EXA-11340

                if (filterID) {

                    var filter = commonjs.loadedStudyFilters.get(filterID);
                    commonjs.currentStudyFilter = filterID;

                    if (filterID === "Files") {
                        self.fileManagementPager = new Pager();
                        self.showFileManagementGrid({
                            pager: self.fileManagementPager,
                            files: new FileManagementCollection(),
                            tableElementId: '#tblClaimGrid' + filterID
                        });

                        self.setFooter({
                            pager: self.fileManagementPager,
                            options: { filterid: filterID }
                        });
                        commonjs.setFilter(filterID, filter);

                        return;
                    }

                    if (!filter) {

                        var createStudiesTable = function () {
                            var id = filterID;
                            self.filterQueries.push({
                                'filterid': id,
                                'rangeIndex': self.dateRangeFilterInitValue,
                                'dateString': $('#divFilterRange span').html(),
                                'startDate': $.trim($("input[name='daterangepicker_start']").val()),
                                'endDate': $.trim($("input[name='daterangepicker_end']").val())
                            });
                            commonjs.resizeHomeScreen();
                            //  self.setTabContents(id, true);
                            commonjs.docResize();

                            var updateStudiesPager = function (model, gridObj) {
                                $('#chkclaimsHeader_' + filterID).prop('checked', false);
                                self.setGridPager(filterID, gridObj, false);
                                self.setClaimBalanceAndFeeDetails(filterID, gridObj);
                                self.bindDateRangeOnSearchBox(gridObj, 'claims', 'claim_dt');
                                self.afterGridBindclaims(model, gridObj);
                                commonjs.nextRowID = 0;
                                commonjs.previousRowID = 0;
                                app.listStudies = gridObj.datastore.map(function (claims) {
                                    return claims.id;
                                });
                                commonjs.setFilter(filterID, gridObj);
                            };
                            var table = new ClaimsGrid({
                                'isAdmin': self.isAdmin,
                                'gridelementid': '#tblClaimGrid' + filterID,
                                'filterid': filterID,
                                'setpriorstudies': '',
                                'isPrior': false,
                                'isDicomSearch': false,
                                'providercontact_ids': app.providercontact_ids,
                                'searchByAssociatedPatients': '',
                                'isRisOrderSearch': false,
                                'showEncOnly': false,
                                'claims_id': 0,
                                'container': self.el,
                                '$container': self.$el,
                                'updateStudiesPager':updateStudiesPager,
                                'isClaimGrid': true,
                                'context': this
                            });
                            table.renderStudy();

                            $('#btnValidateExport').off().click(function () {
                                var filterData = '';
                                var filterCol = '';
                                $('#btnValidateExport').css('display', 'none');
                                var filter_current_id = $('#claimsTabs').find('.active a').attr('data-container')
                                var filter = commonjs.loadedStudyFilters.get(filter_current_id);
                                if (filter && filter.pager && filter.pager.get('FilterData') === "") {
                                    var toDate = moment();
                                    var fromDate = moment().subtract(89, 'days');
                                    filterData = "[\""+ fromDate.format("YYYY-MM-DD") + " - " + toDate.format("YYYY-MM-DD") +"\"]"
                                    filterCol = "[\"claim_dt\"]"
                                }
                                else{
                                    filterData = filter && filter.pager && JSON.stringify(filter.pager.get('FilterData')),
                                    filterCol = filter && filter.pager && JSON.stringify(filter.pager.get('FilterCol'));
                                }
                                table.renderStudy(true, filterData, filterCol);
                            });
                        };

                        createStudiesTable();
                    }
                    else {
                        app.listStudies = filter.datastore.map(function (claims) {
                            return claims.id;
                        });
                        self.toggleTabContents(filterID);
                        self.setFooter(filter);

                        // Auto Refresh the preloaded grid immediately
                        self.refreshClaims(undefined, undefined, filter, function (filter) {
                            commonjs.setFilter(filterID, filter);
                        });
                    }
                }

                // SMH Bug #2606 - Hides icons if necessary when setting up the table.
               // commonjs.toggleGridlistColumns();
            },

            afterGridBindclaims: function () {
                $('.ui-jqgrid-bdiv').scrollLeft(commonjs.scrollLeft);
            },

            setRangeFilter: function (filterid) {
                var obj = this.getFilterObject(filterid);
                $('.ranges li').removeClass('active');
                $('#divFilterRange span').html(obj.dateString);
                $("input[name='daterangepicker_start']").val(obj.startDate);
                $("input[name='daterangepicker_end']").val(obj.endDate);
            },

            setGridPager: function (filterID, filterObj) {
                var self = this;
                filterObj.options.filterid = filterID;

                if (filterObj.options.isSearch) {
                    var url ="/exa_modules/billing/claim_workbench/claims_total_records";
                    var flag = /Exceedclaims/.test(filterID);
                    jQuery.ajax({
                        url: url,
                        type: "GET",
                        data: {
                            filterData: JSON.stringify(filterObj.pager.get('FilterData')),
                            filterCol: JSON.stringify(filterObj.pager.get('FilterCol')),
                            isExceedsMaxTime: flag,
                            customArgs: {
                                show_comp_pend_list: app.show_comp_pend_list,
                                showdeletedpendingstudies: app.showdeletedpendingstudies,
                                flag: 'home_claims',
                                filter_id: filterID,
                                isExceedsMaxTime: filterID !== 'OD' && filterID !== 'PS' && filterID !== 'SU' && filterID !== 'QR',
                                showdeletedstudies: !!(app.showdeletedstudies),
                                statusCode: filterObj.options.customargs && filterObj.options.customargs.statusCode ? filterObj.options.customargs.statusCode : [],
                                isDicomSearch: filterObj.options.isDicomSearch,
                                providercontact_ids: app.providercontact_ids,
                                searchByAssociatedPatients: self.userSettings.searchByAssociatedPatients,
                                isRisOrderSearch: filterObj.options.isRisOrderSearch,
                                isAuthorizationExpSearch: filterObj.options.isAuthorizationExpSearch,
                                isAuthorizationSearch: filterObj.options.isAuthorizationSearch,
                                showEncOnly: filterObj.options.showEncOnly,
                                applyFilter: $('#showQCApplyFilter').prop('checked'),
                                clearFilter: $('#showQCClearFilter').prop('checked'),
                                patient_id: filterObj.options.isPrior ? $('#claimsTabs').find('.active a').attr('data-patient_id') : (commonjs.prior_patient_id > 0) ? commonjs.prior_patient_id : 0,
                                claims_dt: (commonjs.prior_claims_dt) ? commonjs.prior_claims_dt : null,
                                order_id: commonjs.prior_order_id ? commonjs.prior_order_id : 0,
                                showOnlyPhyOrders: $('#showOnlyPhyOrders').prop('checked'),
                                showOnlyOFOrders: $('#showOnlyOFOrders').prop('checked'),
                                isPrior: filterObj.options.isPrior,
                                isDatePickerClear: self.datePickerCleared // to bind the date by default(three months) -- EXA-11340
                            }

                        },
                        success: function (data) {
                            if (data && data.length) {
                                filterObj.pager.set({
                                    "TotalRecords": data[0].total_records
                                });
                                filterObj.pager.set({
                                    "ExceedStudies": data[0].exceeds_count
                                });

                                filterObj.setPagerInfos();
                                filterObj.options.isSearch = false;
                               // if (filterID === commonjs.currentStudyFilter) {
                                    self.setFooter(filterObj);
                                    commonjs.setFilter(filterID, filterObj);
                                    commonjs.docResize();
                               // }

                            }
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }
                else {
                    this.setFooter(filterObj);
                    commonjs.setFilter(filterID, filterObj);
                }
            },

            setClaimBalanceAndFeeDetails: function (filterID, filterObj) {
                var self = this;
                filterObj.options.filterid = filterID;

                if (filterObj.options.isSearch) {
                    var url ="/exa_modules/billing/claim_workbench/claims_total_balance";
                    jQuery.ajax({
                        url: url,
                        type: "GET",
                        data: {
                            filterData: JSON.stringify(filterObj.pager.get('FilterData')),
                            filterCol: JSON.stringify(filterObj.pager.get('FilterCol')),
                            customArgs: {
                                flag: 'home_claims',
                                filter_id: filterID,
                                isDatePickerClear: self.datePickerCleared
                            }
                        },
                        success: function (data) {
                            if (data && data.length) {

                                filterObj.pager.set({
                                    "TotalChargeBillFee": data[0].charges_bill_fee_total
                                });
                                filterObj.pager.set({
                                    "TotalClaimBalance": data[0].claim_balance_total
                                });

                                filterObj.options.isSearch = false;
                                self.setFooter(filterObj);
                            }
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }
                else {
                    this.setFooter(filterObj);
                    commonjs.setFilter(filterID, filterObj);
                }
            },

            setFooter: function (filter) {
                var self = this;

                var pagerObj = filter.pager;
                var totalRecords = pagerObj.get('TotalRecords');
                if (/^Exceedclaims.*/.test(filter.options.filterid)) {
                    totalRecords = pagerObj.get('ExceedStudies');
                }

                var pageSize = parseInt(pagerObj.get('PageSize'));
                var startIndex = ((pagerObj.get('PageNo') - 1) * pageSize) + 1;
                var endIndex = ((startIndex + pageSize - 1) > totalRecords) ? totalRecords : (startIndex + pageSize - 1);
                $('#spnTotalRecords').html(totalRecords);
                $('#spnExceedsTime').html(pagerObj.get('ExceedStudies'));
                $('#spnCurrentPage').html(1);
                $('#spnTotalPage').html(endIndex);
                $("#divclaimsFooter #divPager .pagination li").removeClass("disabled");
                if (pagerObj.get('PageNo') == 1) {
                    $('#liHomeFirst').addClass('disabled');
                    $('#liHomePrev').addClass('disabled');
                }
                if (pagerObj.get('PageNo') == pagerObj.get('LastPageNo')) {
                    $('#liHomeNext').addClass('disabled');
                    $('#liHomeLast').addClass('disabled');
                }
                if (pagerObj.get('TotalRecords') == 0) {
                    self.disablePageControls();
                }

                $('input:checkbox[name=showDicom]').prop('checked', !!filter.options.isDicomSearch);
                $('input:checkbox[name=showRis]').prop('checked', !!filter.options.isRisOrderSearch);
                $('#showPreOrder').prop('checked', !!filter.options.isAuthorizationSearch);
                $('#showLeftPreOrder').prop('checked', !!filter.options.isAuthorizationExpSearch)
                $('#hdnShowEncOnly').attr('data-showEncOnly', !!(filter.options.showEncOnly == "true" || filter.options.showEncOnly == true));
                $('#showOnlyPhyOrders').prop('checked', !!filter.options.showOnlyPhyOrders)
                $('#showOnlyOFOrders').prop('checked', !!filter.options.showOnlyOFOrders)

                commonjs.hideLoading();
                $('#showDicomStudies').attr('disabled', false);
                $('#showRisOrders').attr('disabled', false);
                $('#showPreOrder').attr('disabled', false);
                $('#showLeftPreOrder').attr('disabled', false);
                $('#showOnlyPhyOrders').removeAttr('disabled');
                $('#showOnlyOFOrders').removeAttr('disabled');

                var totalChargeBillFee = pagerObj.get('TotalChargeBillFee') || '$0';
                var totalClaimBalance = pagerObj.get('TotalClaimBalance') || '$0';
                var activeTabId = $("#navbarNavAltMarkup ul li a.active").attr('id');
                if (filter.options && filter.options.isClaimGrid && activeTabId === 'aClaims') {
                    $('#spnTotalBalance').html(totalClaimBalance);
                    $('#spnTotalBillingFee').html(totalChargeBillFee);

                    $('#spanTotalBalance, #spanTotalBillingFee').removeClass('d-none');
                } else {
                    $('#spanTotalBalance, #spanTotalBillingFee').addClass('d-none')
                }
            },

            disablePageControls: function () {
                $('#liHomeFirst').addClass('disabled');
                $('#liHomePrev').addClass('disabled');
                $('#liHomeNext').addClass('disabled');
                $('#liHomeLast').addClass('disabled');
                $('#showDicomStudies').attr('disabled', true);
                $('#showRisOrders').attr('disabled', true);
                $('#showPreOrder').attr('disabled', true);
                $('#showLeftPreOrder').attr('disabled', true);
                $('#showOnlyPhyOrders').attr('disabled', true);
                $('#showOnlyOFOrders').attr('disabled', true);
            },

            navigateRecords: function (filterID, arg) {
                var filter = commonjs.loadedclaimsFilters.get(filterID);
                filter.doPaging(arg, function (filterObj) {
                    commonjs.setFilter(filterID, filterObj);
                });
            },

            studyFilterModel: function () {
                commonjs.showDialog({
                    header: 'Study Filter',
                    i18nHeader: 'shared.screens.setup.studyFilter',
                    width: '75%',
                    height: '75%',
                    url: '/vieworder#setup/studyFilters/all/model',
                    onLoad: 'removeIframeHeader()'
                });
            },

            userSettingsModel: function () {
                commonjs.showDialog({
                    header: 'User Settings',
                    i18nHeader: 'setup.userSettings.headings.userSettings',
                    width: '90%',
                    height: '80%',
                    url: '/vieworder#setup/userSettings/all/model'
                });
            },

            getFilterObject: function (filterID) {
                var obj = '';
                $.each(this.filterQueries, function (i, data) {
                    if (data.filterid == filterID) {
                        obj = data;
                        return obj;
                    }
                });
                return obj;
            },

            refreshClaims: function (isFromDatepicker, IsUnload, filter, callback) {

                // Retrieve scroll position
                var curScroll = $('.tab-pane.active .ui-jqgrid-bdiv').scroll();
                // Retreive selected rows
                var curSelection = $('.tab-pane.active .ui-jqgrid-bdiv table tr.customRowSelect');

                $('#btnClaimsRefresh, #btnClaimRefreshAll').prop('disabled', true);
                var self = this;
                if (isFromDatepicker && isFromDatepicker.target) {
                    if (isFromDatepicker.target.id == 'showQCApplyFilter') {
                        $('#showQCClearFilter').prop('checked', false);
                        $('#showOnlyPhyOrders').prop('checked', false);
                        $('#showOnlyOFOrders').prop('checked', false);
                    }
                    else if (isFromDatepicker.target.id == 'showQCClearFilter') {
                        $('#showQCApplyFilter').prop('checked', false);
                        $('#showOnlyPhyOrders').prop('checked', false);
                        $('#showOnlyOFOrders').prop('checked', false);
                    }
                    else if (isFromDatepicker.target.id == 'showOnlyPhyOrders') {
                        $('#showPreOrder').prop('checked', false);
                        $('#showLeftPreOrder').prop('checked', false);
                        $('#showOnlyOFOrders').prop('checked', false);
                    }
                    else if (isFromDatepicker.target.id == 'showOnlyOFOrders') {
                        $('#showPreOrder').prop('checked', false);
                        $('#showLeftPreOrder').prop('checked', false);
                        $('#showOnlyPhyOrders').prop('checked', false);
                    }
                }
                self.disablePageControls();
                // Reset Interval, Auto Refresh the grid every 60 seconds
                // clearInterval(self.autoRefreshTimer);

                filter = filter || commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                if (filter) {
                    var $tblClaimGrid = filter.customGridTable || $(filter.options.gridelementid);
                    var $currentStudyTab = $(document.getElementById('studyTabs')).find('a').filter('[href="#divClaimGridContainer' + commonjs.currentStudyFilter + '"]');
                    var isDicomSearch = $currentStudyTab.attr('data-showDicom') == "true";
                    var isRisOrderSearch = $currentStudyTab.attr('data-showRisOrder') == "true";
                    var showEncOnly = $currentStudyTab.attr('data-showEncOnly') == "true";

                    filter.options.customargs.isDicomSearch = filter.options.isDicomSearch = isDicomSearch;
                    filter.options.customargs.isRisOrderSearch = filter.options.isRisOrderSearch = isRisOrderSearch;
                    filter.options.customargs.isAuthorizationSearch = filter.options.isAuthorizationSearch = $('#showPreOrder').is(':checked');
                    filter.options.customargs.isAuthorizationExpSearch = filter.options.isAuthorizationExpSearch = $('#showLeftPreOrder').is(':checked');
                    filter.options.customargs.isDatePickerClear = self.datePickerCleared; // to bind the date by default(three months) -- EXA-11340

                    if ($('#showPreOrder').is(':checked') || $('#showLeftPreOrder').is(':checked')) {
                        filter.options.customargs.showOnlyPhyOrders = filter.options.showOnlyPhyOrders = false;
                        filter.options.customargs.showOnlyOFOrders = filter.options.showOnlyOFOrders = false;
                    }
                    else {
                        filter.options.customargs.showOnlyPhyOrders = filter.options.showOnlyPhyOrders = $('#showOnlyPhyOrders').is(':checked');
                        filter.options.customargs.showOnlyOFOrders = filter.options.showOnlyOFOrders = $('#showOnlyOFOrders').is(':checked');
                    }

                    filter.options.customargs.showEncOnly = filter.options.showEncOnly = showEncOnly;
                    filter.options.customargs.isClaimGrid = filter.options.isClaimGrid = true;
                    filter.options.customargs.applyFilter = $('#showQCApplyFilter').prop('checked');
                    filter.options.customargs.clearFilter = $('#showQCClearFilter').prop('checked');
                    if (commonjs.currentStudyFilter != 'PS') {
                        filter.options.customargs.statusCode = filter.options.customargs.statusCode ? filter.options.customargs.statusCode : [];
                    }
                    else {
                        filter.options.customargs.statusCode = [];
                    }

                    filter.options.isSearch = true;
                    filter.pager.set({"PageNo": 1});
                    if (filter && filter.options && filter.options.customargs) {
                        filter.options.customargs.isExceedsMaxTime = commonjs.currentStudyFilter.indexOf('ExceedStudy') > -1;
                    }

                    // Handle grid reload finished to scroll to last position and re-select all previously selected rows
                    if (curScroll.length > 0) {
                        var gridCompleteTimer = 0;
                        $tblClaimGrid.jqGrid("setGridParam", {
                            gridComplete: function () {
                                var regRowClass = /customRowSelect/;
                                clearTimeout(gridCompleteTimer);
                                gridCompleteTimer = setTimeout(function () {
                                    var $bdiv = $('.tab-pane.active').find('.ui-jqgrid-bdiv');
                                    // Hack to fix page sizing issues
                                    if (filter.pager.get('PageNo') === 1 && filter.pager.get('PageSize') === 100) {
                                        filter.pager.set({"PageNo": 4});
                                        filter.pager.set({"PageSize": 25});
                                        // Reset scroll position
                                        $bdiv.scrollTop(curScroll);
                                    }
                                    else {
                                        filter.pager.set({"PageNo": filter.pager.get("PageNo")});
                                        filter.pager.set({"PageSize": 25});
                                    }
                                    // Reset selected rows

                                    if ($bdiv.scrollTop() === curScroll) {
                                        $.each(curSelection, function () {
                                            var id = '#' + this.getAttribute('id');
                                            $bdiv.find('table').find(id).filter(function (i, el) {
                                                return !regRowClass.test(el.className);
                                            }).click();
                                        });
                                        $tblClaimGrid.jqGrid("setGridParam", {
                                            gridComplete: function () {
                                            }
                                        });
                                    }
                                }, 30);
                            }
                        });
                    }
                    // EXA-9228 passing value to identify home page refresh, to set initial page size .
                    filter.refresh(isFromDatepicker || true);
                }
                if (typeof callback === 'function') {
                    return callback(filter);
                }
                return filter;
            },
            reprocessConflicts: function () {

                if (window.confirm(commonjs.geti18NString('messages.status.areYouSureYouWantToReprocessTheConflicts'))) {
                    var self = this;
                    commonjs.showLoading();
                    jQuery.ajax({
                        url: "/qc/reprocess_conflicts",
                        type: "PUT",
                        data: {},
                        success: function () {
                            commonjs.hideLoading();
                            self.refreshClaims(true);
                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }
            },

            removeStudyTab: function (filterID) {
                var index = commonjs.studyFilters.findIndex(function (filter) {
                    if (filter.filter_id == filterID) {
                        return true;
                    }
                });
                var gridObj = commonjs.loadedStudyFilters.get(filterID);
                if (gridObj) {
                    commonjs.setFilter(filterID, null);
                }
                commonjs.studyFilters = commonjs.studyFilters.delete(index);
                var nextFilterID = commonjs.currentStudyFilter == filterID ?
                    commonjs.studyFilters.get(index ? index - 1 : index).filter_id :
                    commonjs.currentStudyFilter;
                commonjs.currentStudyFilter = nextFilterID;
                this.getStudyFilter(nextFilterID);
                return true;
            },

            refreshStudyTab: function () {
                this.getStudyFilter(commonjs.currentStudyFilter, false);
            },

            refreshAllClaims: function () {
                var self = this;

                if (commonjs.currentStudyFilter === 'Files') {
                    self.setTabContents("Files", false, false, false, false);
                    return;
                }

                $('#btnClaimsRefresh, #btnClaimRefreshAll').prop('disabled', true);
                var filter = commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                var $loading = $(document.getElementById('divPageLoading'));
                $loading.show();
                commonjs.showLoading();
                $("#btnInsuranceClaim").show();
                $("#btnPaperClaim").show();
                jQuery.ajax({
                    url: "/exa_modules/billing/user_settings",
                    type: "GET",
                    data: {
                        gridName: 'claims'
                    },
                    success: function (resp) {
                        commonjs.hideLoading();
                        resp = resp && (resp.length >=1) && resp[1].rows && resp[1].rows[0] ? resp[1].rows[0] : {};
                        if (resp) {
                            app.claim_user_settings = Object.assign({}, app.claim_user_settings, resp);
                            var fid = filter && filter.options && filter.options.filterid;
                            var isprior = filter && filter.options && filter.options.isPrior;
                            var $currentstudyTab = $(document.getElementById('studyTabs')).find('a').filter('[href="#divClaimGridContainer' + fid + '"]');
                            var isDicomSearch = $currentstudyTab.attr('data-showDicom') === "true";
                            var isRisOrderSearch = $currentstudyTab.attr('data-showRisOrder') === "true";
                            var showEncOnly = $currentstudyTab.attr('data-showEncOnly') === "true";
                            if (filter && filter.options) {
                                filter.options.isDicomSearch = isDicomSearch;
                                filter.options.isRisOrderSearch = isRisOrderSearch;
                                filter.options.showEncOnly = showEncOnly;
                            }
                            $('input:checkbox[name=showDicom]').prop('checked', isDicomSearch);
                            $('input:checkbox[name=showRis]').prop('checked', isRisOrderSearch);
                            filter.customGridTable.jqGrid('GridUnload');
                            commonjs.setFilter(null, null);
                            self.setTabContents(fid, isprior, isDicomSearch, isRisOrderSearch, showEncOnly);
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });

                $('#divStatusSearch :checkbox').attr("checked", false);
            },

            getStudyFilter: function (filterID) {
                $('input:checkbox[name=showDicom]').prop('checked', false);
                $('input:checkbox[name=showRis]').prop('checked', false);
                var self = this;

                commonjs.setCookieOptions(5, filterID + '__' + (new Date()).getTime());
                this.studyFiltersModel = new ModelClaimsFilters();
                this.studyFiltersModel.fetch({
                    data: {
                        id: filterID,
                        flag: "home_study"
                    },
                    success: function (model, response) {
                        if (commonjs.isValidResponse(response)) {
                            if (response) {
                                var currentstudyTabID = '#studyTabs a[href="#divClaimGridContainer' + filterID + '"]';
                                var $currentStudyTab = $(currentstudyTabID);
                                var currentTabBorderColor = $currentStudyTab.css('border-top-color');

                                self.studyFilters.fetch({
                                    data: {},
                                    success: function (model, response) {
                                        if (commonjs.isValidResponse(response)) {
                                            var studyFilters = response || [];
                                            commonjs.studyFilters = Immutable.List(studyFilters);
                                            self.setFiltertabs(studyFilters);
                                        }
                                    },
                                    error: function (model, response) {
                                        commonjs.handleXhrError(model, response);
                                    }
                                });
                                if (typeof $currentStudyTab.attr('style') !== 'undefined' && /background/.test($currentStudyTab.attr('style'))) {
                                    $currentStudyTab
                                        .css({
                                            'border-top-width': '3px',
                                            'border-top-color': currentTabBorderColor
                                        })
                                        .closest('li')
                                        .css('margin-bottom', '-3px');
                                }
                            }
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            toggleTabContents: function (filterID) {
                var filters = ["Follow_up_queue", "Files"];
                commonjs.processPostRender({screen: 'Claim Workbench'});
                var btnValidateOrder = $("#btnValidateOrder");
                var btnInsuranceClaim = $("#btnInsuranceClaim");
                var btnValidateExport = $("#btnValidateExport");
                var btnPaperClaim = $("#btnPaperClaim");
                var btnRefresh = $('#btnClaimsRefresh');

                if (filters.indexOf(filterID) > -1) {

                    if (filterID === "Follow_up_queue") {
                        btnPaperClaim.hide();
                        btnRefresh.show();
                    } else if (filterID === "Files") {
                        btnRefresh.hide();
                    }

                    btnInsuranceClaim.hide();
                    btnValidateOrder.hide();
                    btnValidateExport.hide();
                } else {
                    btnPaperClaim.show();
                    btnValidateOrder.show();
                    btnValidateExport.show();
                    btnRefresh.show();
                }

                $('#divPageLoading').hide();
                $('#diveHomeIndex').show();
                $('#divStudyFooter').show();
                $("#divStudyFooter").show();
                $("#divStudyFooterSetup").show();
                $("#divStudyFooterSetup :button").show();
                $('#divshowcheckStudies').show();
                $('#btnNoneStudy').show();
                $('#btnAllStudy').show();
                $('#showStudyFilterControl').hide();
                $('#btnNewStudy').show();
                $('#studyRightMenu').hide();
                if (app.refproviderID > 0) {
                    $('.hide_btncontent').attr("disabled", true);
                }

            },

            bindFileType: function () {
                switch (app.billingRegionCode) {
                    case 'can_AB':
                        return {
                            "": "All",
                            "can_ahs_ard": i18n.get('billing.payments.payment'),
                            "can_ahs_bbr": i18n.get('billing.claims.acknowledgement'),
                            "can_ahs_a" : i18n.get('billing.claims.submissionA'),
                            "can_ahs_c" : i18n.get('billing.claims.submissionC'),
                            "can_ahs_r" : i18n.get('billing.claims.submissionR'),
                            "can_ahs_d" : i18n.get('billing.claims.submissionD'),
                            "can_ab_wcb_c568": i18n.get('billing.claims.submissionC568'),
                            "can_ab_wcb_c570": i18n.get('billing.claims.submissionC570'),
                            "can_ab_wcb_ra": i18n.get('billing.claims.paymentWCB')
                        };
                    case 'can_MB':
                        return {
                            "": "All",
                            "can_ohip_p": i18n.get('billing.payments.payment'),
                            "success": "Submitted",
                            "pending": "Pending"
                        };
                    case 'can_ON':
                        return {
                            "": "All",
                            "can_ohip_p": i18n.get('billing.payments.payment'),
                            "can_ohip_b": i18n.get('billing.claims.acknowledgement'),
                            "can_ohip_x": i18n.get('billing.claims.rejection'),
                            "can_ohip_e": i18n.get('billing.claims.correction'),
                            "can_ohip_h": i18n.get('billing.claims.submission')
                        };
                    case 'can_BC':
                        return {
                            "": "All",
                            "can_bc_remit": i18n.get('billing.payments.payment'),
                            "can_bc_submit" : i18n.get('billing.claims.submission')
                        };
                    default:
                        return {
                            "": "All",
                            "can_ahs_ard": i18n.get('billing.payments.payment'),
                            "can_ahs_bbr": i18n.get('billing.payments.acknowledgement')
                        };
                }
            },

            showFileManagementGrid: function (options) {
                var self = this;
                var file_type = self.bindFileType();
                var current_status = {
                    "": "All",
                    "pending": i18n.get('billing.claims.pending'),
                    "in_progress": i18n.get('billing.claims.inprogress'),
                    "duplicate": i18n.get('billing.claims.duplicate'),
                    "partial": i18n.get('billing.claims.partial'),
                    "nomatch": i18n.get('billing.claims.nomatch'),
                    "failure": i18n.get('billing.claims.failure'),
                    "success": i18n.get('billing.claims.success')
                };
                self.fileManagementTable = new customGrid();
                self.fileManagementTable.render({
                    gridelementid: options.tableElementId,
                    custompager: options.pager,
                    emptyMessage: i18n.get("messages.status.noRecordFound"),
                    colNames: [
                        "",
                        "",
                        "File Name",
                        "File Type",
                        "Submitted Date",
                        "Status",
                        "Acknowledgement Received",
                        "Payment Received",
                        "",
                        "Total Amount Payable"
                    ],
                    i18nNames: [
                        "",
                        "",
                        "billing.claims.fileName",
                        "billing.claims.fileType",
                        "billing.claims.submittedDate",
                        "patient.patient.status",
                        "billing.claims.acknowledgementReceived",
                        "billing.claims.paymentReceived",
                        "",
                        "billing.claims.totalAmountPayable"
                    ],
                    colModel: [
                        { name: '', index: 'id', key: true, search: false, width: 25 },
                        {
                            name: 'error_data', width: 20, sortable: false, search: false,
                            className: 'icon-ic-raw-transctipt',
                            formatter: function (cellvalue, options, rowObject) {
                                return (rowObject.error_data && JSON.parse(rowObject.error_data).length) && "<i class='icon-ic-raw-transctipt' i18nt='billing.fileInsurance.errorMsg'></i>" || '';
                            },
                            customAction: function (rowID) {
                                var gridData = $(options.tableElementId).jqGrid('getRowData', rowID);
                                var errorContent = '<div style="width:100%;height:100%" id="divError"><textarea style="width:100%;height:100%" id="txtAreaErrorData">' + JSON.stringify(gridData.error_data, undefined, 4) + '</textarea></div>';

                                commonjs.showDialog({
                                    header: 'OHIP  Submission Error',
                                    i18nHeader: 'shared.moduleheader.ohipClaims',
                                    width: '50%',
                                    height: '50%',
                                    html: errorContent
                                });
                            }
                        },
                        {
                            name: 'file_name',
                            search: true,
                            width: 150
                        },
                        {
                            name: 'file_type',
                            width: 200,
                            stype: 'select',
                            formatter: self.fileTypeFormatter,
                            "searchoptions": {
                                "value": file_type,
                                "tempvalue": file_type
                            }
                        },
                        {
                            name: 'updated_date_time',
                            search: true,
                            width: 175,
                            formatter: function (value) {
                                return commonjs.checkNotEmpty(value) ? commonjs.getFormattedUtcDate(value) : '';
                            }
                        },
                        {
                            name: 'current_status',
                            width: 215,
                            stype: 'select',
                            formatter: self.currentStatusFormatter,
                            "searchoptions": {
                                "value": current_status,
                                "tempvalue": current_status
                            }
                        },
                        {
                            name: 'is_acknowledgement_received',
                            search: false,
                            width: 225,
                            align: 'center',
                            formatter: function (value, model, data) {
                                return (data.is_acknowledgement_received === "true")
                                    ? '<i class="fa fa-check" style="color: green" aria-hidden="true"></i>'
                                    : '<i class="fa fa-times" style="color: red" aria-hidden="true"></i>';
                            },
                            customAction: function () {
                                return false;
                            }
                        },
                        {
                            name: 'is_payment_received',
                            search: false,
                            width: 150,
                            align: 'center',
                            formatter: function (value, model, data) {
                                return (data.is_payment_received === "true")
                                    ? '<i class="fa fa-check" style="color: green" aria-hidden="true"></i>'
                                    : '<i class="fa fa-times" style="color: red" aria-hidden="true"></i>';
                            },
                            customAction: function () {
                                return false;
                            }
                        },
                        {
                            name: 'apply_button',
                            search: false,
                            sortable: false,
                            width: 150,
                            formatter: function (value, model, data) {
                                var disableStatus = data.current_status === 'success' ? "disabled" : "";
                                return data.file_type === 'can_ohip_p' && (data.totalAmountPayable || data.accountingTransactions.length) ? '<button i18n="shared.buttons.apply" id="file' + data.id + '" class="btn btn-primary btn-block" ' + disableStatus + '/>' : '';
                            },
                            customAction: function (rowID, e, data) {
                                var rowData = data.getData(rowID);
                                self.applyFileManagement(rowID, rowData.payment_id);
                            }
                        },
                        { name: 'total_amount_payable',
                          width: 500,
                          search: false,
                          sortable: false,
                          validateMoney : true,
                          formatter: function (value, model, data) {
                              if (data.file_type === 'can_ohip_p') {
                                var getRowColor = function(code) {
                                    var rowColor = {
                                        '10': 'table-warning',
                                        '20': 'table-danger',
                                        '40': 'table-success',
                                        '50': 'table-primary'
                                    };
                                    return rowColor[code] || '';
                                };

                                var trColor = '';
                                var amountPayable = data.totalAmountPayable && data.totalAmountPayable.toFixed(2) || null
                                var accountTransaction = data.accountingTransactions || [];
                                var retVal = '';

                                if(amountPayable) {
                                    retVal += '<tr><td>' + commonjs.geti18NString("billing.claims.totalAmountPayable") + '</td><td>' + amountPayable + '</td></tr>';
                                }

                                if(accountTransaction.length) {
                                    for (var i = 0; i < accountTransaction.length; i++) {
                                        trColor = getRowColor(accountTransaction[i].transactionCode);
                                        retVal += '<tr class="' + trColor + '"><td>' + accountTransaction[i].transactionMessage + '}</td>';
                                        retVal += '<td>$' + accountTransaction[i].transactionAmount.toFixed(2) + '</td></tr>';
                                    }
                                }

                                retVal = retVal.length ? '<table class="table table-bordered"><tbody>' + retVal + '</tbody></table>' : '';
                                return retVal;

                              }
                                return '';

                            }
                        },
                    ],
                    datastore: options.files,
                    customizeSort: true,
                    container: self.el,
                    pager: '#gridPagerFileManagement',
                    sortname: 'id',
                    sortorder: 'DESC',
                    disablepaging: false,
                    customargs:{
                        filter_id: commonjs.currentStudyFilter,
                        isClaimGrid: true,
                        isDicomSearch: null,
                        isRisOrderSearch: null,
                        isAuthorizationSearch: null,
                        isAuthorizationExpSearch: null
                    },
                    beforeRequest: function () {
                        self.refreshClaims(true);
                    },
                    onaftergridbind: function(model, gridObj){
                        gridObj.options.filterid = commonjs.currentStudyFilter;

                        options.pager.set({
                            "TotalRecords": model.length ? model[0].get('total_records') : 0
                        });
                        self.setFooter({
                            pager:  options.pager,
                            options: { filterid: options.filterID }
                        });
                        self.bindDateRangeOnSearchBox(gridObj, 'claims', 'updated_date_time');
                        commonjs.setFilter(commonjs.currentStudyFilter, gridObj);
                    }
                });

                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
            },

            initEbsListResults: function(dataset) {
                if (dataset.length) {
                    this.edtListResults = dataset;
                }
            },

            currentStatusFormatter: function (cellvalue, options, rowObject) {

                switch (rowObject.current_status) {
                    case 'in_progress':
                        return i18n.get('billing.claims.inprogress');
                    case 'duplicate':
                        return i18n.get('billing.claims.duplicate');
                    case 'failure':
                        return i18n.get('billing.claims.failure');
                    case 'success':
                        return i18n.get('billing.claims.success');
                    case 'pending':
                        return i18n.get('billing.claims.pending');
                    case 'partial':
                        return i18n.get('billing.claims.partial');
                    case 'nomatch':
                        return i18n.get('billing.claims.nomatch');
                    default:
                        return i18n.get('billing.claims.created');
                }
            },

            fileTypeFormatter: function (cellvalue, options, rowObject) {

                switch (rowObject.file_type) {
                    case 'can_ohip_p':
                    case 'can_ahs_ard':
                    case 'can_bc_remit':
                    case 'can_ab_wcb_ra':
                        return i18n.get('billing.payments.payment');
                    case 'can_ohip_b':
                    case 'can_ahs_bbr':
                        return i18n.get('billing.claims.acknowledgement');
                    case 'can_ohip_x':
                        return i18n.get('billing.claims.rejection');
                    case 'can_ohip_e':
                        return i18n.get('billing.claims.correction');
                    case 'can_ahs_a':
                        return i18n.get('billing.claims.submissionA');
                    case 'can_ahs_c':
                        return i18n.get('billing.claims.submissionC');
                    case 'can_ahs_r':
                        return i18n.get('billing.claims.submissionR');
                    case 'can_ahs_d':
                        return i18n.get('billing.claims.submissionD');
                    case 'can_ab_wcb_c568':
                        return i18n.get('billing.claims.submissionC568');
                    case 'can_ab_wcb_c570':
                        return i18n.get('billing.claims.submissionC570');
                    case 'can_ohip_h':
                    default:
                        return i18n.get('billing.claims.submission');
                }
            },

            showHCVConformanceTesting: function () {
                var self = this;

                if (this.edtListResults)
                self.conformanceTestingPager = new Pager();

                commonjs.showDialog({
                    header: 'HCV Conformance Testing',
                    // i18nHeader: 'billing.claims.conformanceTesting',
                    width: '90%',
                    height: '80%',
                    html: self.hcvFormTemplate({
                        // ddlResourceType: self.ebsResourceTypesTemplate({
                        //     domId: 'ohipResourceType'
                        // })
                    })
                });

                $('#btnAddHCVRequest').off('click').on('click', function() {
                    $('#divHCVRequests').append(self.hcvRequestTemplate());
                });
                $('#btnHCVSubmit').off('click').on('click', function() {
                    var hcvRequests = _.map($('.ebs-hcv-request'), function(upload) {
                        return {
                            healthNumber: $(upload).find('.ohip-health-number').val(),
                            versionCode: $(upload).find('.ohip-version-code').val(),
                            feeServiceCode: $(upload).find('.ohip-fee-service-code').val()
                        };
                    });


                    $.ajax({
                        url: '/exa_modules/billing/ohip/ct',
                        type: 'POST',
                        data: {
                            service: 'validate',
                            muid: $("#ddlOHIPUserID").val(),
                            hcvRequests: hcvRequests
                        }
                    }).then(function(response) {
                        self.renderEBSNestedDialog('Results', self.ebsResultsTemplate({
                            auditInfo: response.auditInfo,
                            faults: response.faults,
                            hcvResults: response.results,
                        }));
                    }).catch(function(err) {
                        commonjs.showError(err);
                    })
                });
                $('#btnHCVReset').off('click').on('click', function() {
                    $('#divHCVRequests').empty();
                });

            },

            showEDTConformanceTesting: function () {
                var self = this;

                if (this.edtListResults)
                self.conformanceTestingPager = new Pager();

                commonjs.showDialog({
                    header: 'EDT Conformance Testing',
                    // i18nHeader: 'billing.claims.conformanceTesting',
                    width: '90%',
                    height: '80%',
                    html: self.edtListTemplate({
                        ddlResourceType: self.ebsResourceTypesTemplate({
                            domId: 'ohipResourceType'
                        })
                    })
                });

                $('#resourceInfoBtn').off('click').on('click', function() {
                    self.infoResource();
                });
                $('#resourceUploadBtn').off('click').on('click', function() {
                    self.uploadResource();
                });
                $('#resourceUpdateBtn').off('click').on('click', function() {
                    self.updateResource();
                });
                $('#resourceDeleteBtn').off('click').on('click', function() {
                    self.deleteResource();
                });
                $('#resourceSubmitBtn').off('click').on('click', function() {
                    self.submitResource();
                });
                $('#resourceDownloadBtn').off('click').on('click', function() {
                    self.downloadResource();
                });

                $('#resourceListBtn').off('click').on('click', function() {
                    self.getResourceList();
                });
                $('#resourceGetTypeListBtn').off('click').on('click', function() {
                    self.getTypeList();
                });

                setTimeout(function() {

                    // render important stuff
                    self.showEBSGrid();
                }, 150);
            },


            getCheckedEBSResourceIDs : function() {
                var resourceIDs = [];
                _.forEach($('.ohip_resource_chk:checked'), function(checkedResource) {
                    var rowId = checkedResource.parentNode.parentNode.id;
                    var resourceID = $("#tblConformanceTesting").jqGrid('getCell', rowId, 'resourceID');
                    resourceIDs.push(resourceID);
                });
                return resourceIDs;
            },

            updateEBSList: function(resources) {

                var $tbl = $("#tblConformanceTesting");
                var allDataIDs = $tbl.jqGrid('getDataIDs');

                var resourcesByID = _.groupBy(resources, 'resourceID');

                _.forEach(allDataIDs, function(dataID) {

                    var rowData = $tbl.jqGrid('getRowData', dataID);
                    var resource = resourcesByID[rowData.resourceID] && resourcesByID[rowData.resourceID][0];
                    if (resource) {

                        _.forEach(Object.keys(resource), function(key) {
                            $tbl.jqGrid('setCell', dataID, key, resource[key]);
                        });
                    }
                });

            },



            // for submit, info, download, delete
            sendResourceIDsRequest: function(service) {
                var resourceIDs = this.getCheckedEBSResourceIDs();
                if (!resourceIDs.length) {
                    resourceIDs = $.trim($('#invalidResourceID').val()).split(',');
                }
                return $.ajax({
                    url: '/exa_modules/billing/ohip/ct',
                    type: 'POST',
                    data: {
                        service: service,
                        muid: $("#ohipMUID").val(),
                        resourceIDs: resourceIDs,
                    }
                });
            },




            renderEBSNestedDialog: function(header, html) {
                commonjs.showNestedDialog({
                    header: header,
                    // i18nHeader: 'billing.claims.conformanceTesting',
                    width: '70%',
                    height: '65%',
                    html: html
                });
            },


            handleResourceResult: function(ebsResponse) {
                var allResults = [];
                var successResults = _.reduce(ebsResponse.results, function(results, result) {
                    allResults = allResults.concat(result.response);
                    return results.concat(_.filter(result.response, function(response) {
                        return response.code === ohip.responseCodes.SUCCESS;
                    }));
                }, []);

                this.updateEBSList(successResults);

                this.renderEBSNestedDialog('Results', this.ebsResultsTemplate({
                    auditInfo: ebsResponse.auditInfo,
                    faults: ebsResponse.faults,
                    responseResults: allResults
                }));

            },

            uploadResource: function() {
                var self = this;
                this.renderEBSNestedDialog('Upload', this.ebsUploadTemplate({
                    ddlFixtures: self.ebsFixturesTemplate({}),
                    ddlResourceTypes: self.ebsResourceTypesTemplate({})
                }));


                $('#btnEBSAddFile').click(function() {
                    $('#tblEBSUpload').append('<tr class="ebs-upload"><td>' + self.ebsFixturesTemplate({}) + '</td><td>' + self.ebsResourceTypesTemplate({}) + '</td><td><input type="text" class="ebs-description"></td></tr>');
                });

                $('#btnEBSUpload').click(function() {

                    return $.ajax({
                        url: '/exa_modules/billing/ohip/ct',
                        type: 'POST',
                        data: {
                            service: 'upload',
                            muid: $("#ohipMUID").val(),
                            uploads: _.map($('.ebs-upload'), function(upload) {
                                return {
                                    fixtureID: $(upload).find('.ebs-fixture').val(),
                                    resourceType: $(upload).find('.ebs-resource-type').val(),
                                    description: $(upload).find('.ebs-description').val()
                                };
                            })
                        }
                    }).then(function(response) {
                        self.handleResourceResult(response);
                    }).catch(function(err) {
                        commonjs.showError(err);
                    });
                });
            },

            updateResource: function() {
                var self = this;

                this.renderEBSNestedDialog('Update', this.ebsUpdateTemplate({
                    resourceIDs: self.getCheckedEBSResourceIDs(),
                    ddlFixtures: self.ebsFixturesTemplate({})
                }));

                $('#btnEBSUpdate').click(function() {
                    return $.ajax({
                        url: '/exa_modules/billing/ohip/ct',
                        type: 'POST',
                        data: {
                            service: 'update',
                            muid: $("#ohipMUID").val(),
                            updates: _.map($('.ebs-update'), function(upload) {
                                return {
                                    fixtureID: $(upload).find('.ebs-fixture').val(),
                                    resourceID: $(upload).find('.ebs-resource').val()
                                };
                            })
                        }
                    }).then(function(response) {
                        self.handleResourceResult(response);
                    }).catch(function(err) {
                        commonjs.showError(err);
                    });
                });
            },

            deleteResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_DELETE).then(function(response) {
                    self.handleResourceResult(response);
                }).catch(function(err) {
                    commonjs.showError(err);
                });
            },

            submitResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_SUBMIT).then(function(response) {
                    self.handleResourceResult(response);
                }).catch(function(err) {
                    commonjs.showError(err);
                });
            },

            downloadResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_DOWNLOAD).then(function(response) {

                    self.renderEBSNestedDialog('Results', self.ebsResultsTemplate({
                        auditInfo: response.auditInfo,
                        faults: response.faults,
                        downloadData: _.reduce(response.results, function(allData, result) {
                            return allData.concat(result.data);
                        }, [])
                    }));
                }).catch(function(err) {
                    commonjs.showError(err);
                });
            },

            infoResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_INFO).then(function(response) {
                    self.renderEBSNestedDialog('Results', self.ebsResultsTemplate({
                        auditInfo: response.auditInfo,
                        faults: response.faults,
                        detailData: _.reduce(response.results, function(allData, result) {
                            return allData.concat(result.data);
                        }, [])
                    }));
                }).catch(function(err) {
                    commonjs.showError(err);
                });
            },

            getTypeList: function() {
                var self = this;
                $.ajax({
                    url: '/exa_modules/billing/ohip/ct',
                    type: 'POST',
                    data: {
                        muid: $("#ohipMUID").val(),
                        service: ohip.services.EDT_GET_TYPE_LIST
                    }
                }).then(function(response) {
                    self.renderEBSNestedDialog('Type List', self.ebsResultsTemplate({
                        auditInfo: response.auditInfo,
                        faults: response.faults,
                        typeListData: _.reduce(response.results, function(allData, result) {
                            return allData.concat(result.data);
                        }, [])
                    }));
                }).catch(function(err) {
                    commonjs.showError(err);
                });
            },

            getResourceList: function() {

                var self = this;

                var listParams = {
                    service: 'list',
                    muid: $("#ohipMUID").val(),
                    status: $("#ohipStatus").val(),
                    resourceType: $("#ohipResourceType").val(),
                    pageNo: $('#ohipPageNo').val()
                };



                if (!listParams.status) {
                    delete listParams.status;
                }

                if (!listParams.resourceType) {
                    delete listParams.resourceType;
                }

                // TODO: care about page number
                this.edtListResults.fetch({
                    data: listParams,
                    type: 'POST',
                    success: function(models, response) {
                        if (response.error) {
                            commonjs.showError(response.error);
                        }
                        // $("#tr-no-records").remove();
                        self.renderEBSNestedDialog('Results', self.ebsResultsTemplate({
                            auditInfo: response.auditInfo,
                            faults: response.faults,
                            detailData: _.reduce(response.results, function(allData, result) {
                                return allData.concat(result.data);
                            }, [])
                        }));
                        $("#tblConformanceTesting").find(".ui-widget-content.jqgrow").remove();
                        var $ohipPageNo = $('#ohipPageNo');
                        $ohipPageNo.empty();
                        for (var pageNo = 1; pageNo<=response.results[0].resultSize; pageNo++) {
                            $ohipPageNo.append($('<option />', {
                                value: pageNo,
                                text: pageNo
                            }));
                        }
                    },
                    error: function(err) {
                        commonjs.showError(err);
                    }
                });
            },


            showEBSGrid: function () {
                var self = this;
                self.conformanceTestingTable = new customGrid(self.edtListResults, '#tblConformanceTesting');
                self.conformanceTestingTable.render({
                    gridelementid: '#tblConformanceTesting',
                    custompager: self.conformanceTestingPager,
                    emptyMessage: i18n.get("messages.status.noRecordFound"),
                    colNames: ["", "ID", "Description", "Status", "Code", "Message"],

                    colModel: [
                        { name: '', index: 'id', key: true, hidden: false, search: false, width: 25,
                            formatter: function (cellvalue, options, rowObject) {
                                return '<input type="checkbox" name="chkResource" class="ohip_resource_chk" id="chkResource_' + rowObject.resourceID + '" />'
                            }
                        },
                        {
                            name: 'resourceID',
                            search: false,
                            width: 75
                        },
                        {
                            name: 'description',
                            search: false,
                            width: 200
                        },
                        {
                            name: 'status',
                            search: false,
                            width: 150
                        },
                        {
                            name: 'code',
                            search: false,
                            width: 100
                        },
                        {
                            name: 'msg',
                            search: false,
                            width: 250,
                            // align: 'center',
                            formatter: function (value, model, data) {
                                return data.msg || data.message;
                            }
                        }
                    ],
                    datastore: self.edtListResults,
                    onbeforegridbind: self.initEbsListResults,
                    container: $('#modal_div_container'),
                    sortname: 'status',
                    sortorder: 'ASC',
                    customargs: {
                        service: 'list'
                    }
                });

                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
            },


            applyFileManagement: function (fileId, paymentId) {

                var $applyBtn = $('#file'+ fileId);
                $applyBtn.prop('disabled', true);

                $.ajax({
                    url: "/exa_modules/billing/ohip/applyRemittanceAdvice",
                    type: "POST",
                    data: {
                        edi_files_id: fileId,
                        payment_id : paymentId && paymentId.length && paymentId[0] || null
                    },
                    success: function (data) {
                        if(data.status === 'ERROR') {
                            commonjs.handleXhrError(data.err, null);
                        }
                        else if(data.status === 'IN_PROGRESS') {
                            commonjs.showStatus(data.message);
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },

            clearAllSelectedRows: function () {
                var filterID = commonjs.currentStudyFilter;
                var filter = commonjs.loadedStudyFilters.get(filterID);
                ( filter.customGridTable || $(document.getElementById(filter.options.gridelementid)) ).find('input:checkbox').each(function () {
                    this.checked = false;
                    $(this).closest('tr').removeClass('customRowSelect');
                });
                $('#chkStudyHeader_' + filterID).prop('checked', false);
                commonjs.setFilter(filterID, filter);
            },

            selectAllRows: function () {
                var filterID = commonjs.currentStudyFilter;
                var filter = commonjs.loadedStudyFilters.get(filterID);
                ( filter.customGridTable || $(document.getElementById(filter.options.gridelementid)) ).find('input:checkbox').each(function () {
                    this.checked = true;
                    $(this).closest('tr').addClass('customRowSelect');
                });
                $('#chkStudyHeader_' + filterID).prop('checked', true);
                commonjs.setFilter(filterID, filter);
            },
            scrolleventStudies1: function (filterid, divId) {
                var divid = "#divClaimGrid" + filterid;
                var scrolldiv = "";
                if ($(divid).find("#gview_tblClaimGrid" + filterid)) {
                    scrolldiv = $(divid).find("#gview_tblClaimGrid" + filterid).find(".ui-jqgrid-bdiv");
                }
                scrolldiv.scroll(function () {
                    $("#gs_study_status").focusout();
                    $("#" + divId).hide();
                });
            },
            getGridCellData: function (filter, rowId, cell) {
                return $(filter.options.gridelementid).jqGrid('getCell', rowId, cell);
            },
            validateClaim: function(){
                var self=this;
                var filterID = commonjs.currentStudyFilter;
                var filter = commonjs.loadedStudyFilters.get(filterID);
                var selectedClaimIds =[];
                var existingBillingMethod = null;
                var selectedClaimsRows = $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked');


                for (var i = 0; i < selectedClaimsRows.length; i++) {
                    var rowId = selectedClaimsRows[i].parentNode.parentNode.id;
                    var billingMethod = self.getGridCellData(filter, rowId, 'hidden_billing_method');

                    if (app.country_alpha_3_code === 'can') {

                        if (!billingMethod) {
                            return commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                        }

                        if (!existingBillingMethod)
                            existingBillingMethod = billingMethod;

                        if (billingMethod != existingBillingMethod) {
                            return commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                        }
                    }

                    selectedClaimIds.push(rowId);
                }

                if (!selectedClaimIds.length) {
                    commonjs.showWarning(commonjs.geti18NString("messages.warning.claims.selectClaimToValidate"));
                    return false;
                }

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/validate_claims',
                    type: 'POST',
                    data: {
                        claim_ids: selectedClaimIds,
                        country: app.country_alpha_3_code,
                        billingRegionCode:app.billingRegionCode
                    },
                    success: function (data) {
                        $("#btnValidateOrder").prop("disabled", false);
                        if (data) {
                            commonjs.hideLoading();

                            var isValidClaimData = data.validClaim_data && data.validClaim_data.rows && data.validClaim_data.rows.length;
                            var updateAhsClaimStatusFlag = app.billingRegionCode === 'can_AB' && data.invalidStatus_claims.length;
                            var pending77ClaimStatusFlag = app.billingRegionCode === 'can_MB' && data.validP77Claim_data.length;

                            if (pending77ClaimStatusFlag || updateAhsClaimStatusFlag || isValidClaimData) {
                                commonjs.showStatus("messages.status.validatedSuccessfully");
                                $("#btnClaimsRefresh").click();
                            }

                            if (isValidClaimData) {
                                var pending_submission_status = app.claim_status.filter(function (obj) {
                                    return obj.id === parseInt(data.validClaim_data.rows[0].claim_status_id)
                                });
                                var statusDetail = commonjs.getClaimColorCodeForStatus(pending_submission_status[0].code, 'claim');
                                var color_code = statusDetail && statusDetail[0] && statusDetail[0].color_code || 'transparent';
                                var $gridId = filter.options.gridelementid || '';
                                $gridId = $gridId.replace(/#/, '');
                                var cells = [
                                    {
                                        'field': 'claim_status',
                                        'data': pending_submission_status && pending_submission_status[0].description || '',
                                        'css': {
                                            "backgroundColor": color_code
                                        }
                                    },
                                    {
                                        'field': 'claim_status_code',
                                        'data': pending_submission_status && pending_submission_status[0].code || ''
                                    }
                                ];

                                if ($gridId) {
                                    _.each(data.validClaim_data.rows, function (obj) {
                                        var $claimGrid = $('#' + $gridId + ' tr#' + obj.id);
                                        var $td = $claimGrid.children('td');
                                        commonjs.setGridCellValue(cells, $td, $gridId)
                                    });
                                } else {
                                    commonjs.showWarning(commonjs.geti18NString("messages.errors.gridIdNotExists"));
                                }

                            }

                            if(data.invalidClaim_data.length && data.validClaim_data.rows && data.validClaim_data.rows.length){
                                commonjs.showWarning(commonjs.geti18NString("messages.warning.claims.claimValidationFailed"));
                            }

                            if (data.invalidClaim_data.length) {
                                self.showValidationResult(data.invalidClaim_data);
                            }
                        }
                    },
                    error: function (err, response) {
                        $("#btnValidateOrder").prop("disabled", false);
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            showValidationResult: function(data) {
                var self = this;
                commonjs.previousValidationResults = { isFromEDI: false, result: data };
                commonjs.showDialog({
                    header: 'Validation Results',
                    fromValidate: true,
                    onShown: function () {
                        self.initEvent(false);
                    },
                    onHide: function () {
                        commonjs.previousValidationResults = null;
                        $("#btnClaimsRefresh").click();
                    },
                    i18nHeader: 'billing.claims.validationResults',
                    width: '70%',
                    height: '60%',
                    html: self.claimValidation({ response_data: data })
                });
            },

            processClaim: function(e) {
                var claimView = new claimsView({ worklist: this});
                var studyInfo = {
                    studyIds: e.target.id,
                    grid_id: '#tblClaimGridAll_Claims'
                };

                commonjs.getClaimStudy(studyInfo.studyIds, function (result) {
                    studyInfo.study_id = result && result.study_id || 0;
                    studyInfo.order_id = result && result.order_id || 0;
                    claimView.showEditClaimForm(studyInfo.studyIds, 'reclaim', studyInfo);
                });
            },

            revalidateClaim: function() {
                var self = this;
                var claimRows = $('#divValidateSchClaim').find('.processClaimEdit');
                var claimIds = [];

                if (claimRows.length) {
                    var modalContainer = $('#modal_div_container');
                    for(var i = claimRows.length - 1; i >= 0; i--) {
                        claimIds.push(claimRows[i].id);
                    }
                    commonjs.showLoading();

                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/validate_claims',
                        type: 'POST',
                        data: {
                            claim_ids: claimIds,
                            country: app.country_alpha_3_code,
                            billingRegionCode: app.billingRegionCode
                        },
                        success: function (data) {

                            if (data) {
                                var invalidClaimData = data.invalidClaim_data;

                                if (invalidClaimData.length) {
                                    commonjs.previousValidationResults.result = invalidClaimData;
                                    modalContainer.html(self.claimValidation({ response_data: invalidClaimData }));
                                } else {
                                    modalContainer.html('<div style="text-align: center" >' + commonjs.geti18NString('messages.status.noRecordFound') + '</div>');
                                }
                                self.initEvent(false);
                                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                            }
                            commonjs.hideLoading();
                        },
                        error: function () {
                            commonjs.hideLoading();
                        }
                    });
                }
            },

            initEvent: function(isFromEDI) {
                var self = this;
                $('.processClaimEdit').off('click').on('click', function(e) { self.processClaim(e) });

                if (!isFromEDI) {
                    $('#revalidateClaim').off('click').on('click', function() { self.revalidateClaim() });
                } else {
                    $('#reclaimEDI').off('click').on('click', function(e) {
                        $('#btnClaimFormat').removeAttr("data-disabled");
                        self.createClaims(e, true)
                    });
                }
            },

            /**
             * Get Submit Claim Url
             *
             * @param  {String} billingRegionCode  region code
             */
            getSubmitClaimUrl: function(billingRegionCode, isWCBBilling) {

                switch(billingRegionCode) {
                    case 'can_AB':
                        return !isWCBBilling
                            ? '/exa_modules/billing/ahs/submitClaims'
                            : '/exa_modules/billing/ahs/submitWcbClaim';
                    case 'can_MB':
                        return '/exa_modules/billing/mhs/submitClaims';
                    case 'can_ON':
                        return '/exa_modules/billing/ohip/submitClaims';
                    case 'can_BC':
                        return '/exa_modules/billing/bc/submitClaims';
                    default:
                        return '/exa_modules/billing/claim_workbench/create_claim';
                }
            },

            /**
             * Validating response for MHS
             *
             * @param  {Object} data  response result
             */
            mhsResponse: function(data) {

                if (data && data.isInvalidBillingMethod) {
                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                } else if (data.isNotpendingSubmission) {
                    commonjs.showWarning('messages.status.pleaseSelectValidClaimsStatus');
                } else if (data.isFileStoreError) {
                    commonjs.showWarning('messages.warning.era.fileStoreNotconfigured');
                } else if (data.isClaimBillFeeError) {
                    commonjs.showWarning('billing.claims.isClaimBillFeeError');
                } else if (data.isTotalBillFeeError) {
                    commonjs.showWarning('billing.claims.isTotalBillFeeError');
                } else if (data.unableToWriteFile) {
                    commonjs.showError('messages.errors.rootdirectorynotexists');
                } else if (data.error) {
                    commonjs.showError('billing.claims.claimError');
                } else {
                    window.open(window.location.origin + '/exa_modules/billing/mhs/downloadFile?fileStoreId=' + data.id, "_self");
                    $("#btnClaimsRefresh").click();
                }
            },

            /**
             * Validating response for BC
             *
             * @param  {Object} data  response result
             * @param  {Boolean} isFromReclaim  reclaim flag
             */
            bcResponse: function (data, isFromReclaim) {
                var self = this;
                self.ediResultTemplate = _.template(ediResultHTML);

                if (data.responseCode) {
                    switch (data.responseCode) {
                        case 'isInvalidBillingMethod':
                            commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                            break;
                        case 'isNotpendingSubmission':
                            commonjs.showWarning('messages.status.pleaseSelectValidClaimsStatus');
                            break;
                        case 'isFileStoreError':
                            commonjs.showWarning('messages.warning.era.fileStoreNotconfigured');
                            break;
                        case 'unableToWriteFile':
                            commonjs.showError('messages.errors.rootdirectorynotexists');
                            break;
                        case 'submitted':
                            commonjs.showStatus('messages.status.claimSubmitted');
                            break;
                        default:
                            commonjs.showError('billing.claims.claimError');
                    }
                }

                var errorResult = data.errorData;
                if (errorResult && Object.keys(errorResult).length) {
                    commonjs.previousValidationResults = {
                        isFromBC: true,
                        result: $.extend(true, {}, data)
                    };

                    var result = Object.keys(errorResult.reciprocalErrorArray).length ? errorResult.reciprocalErrorArray : errorResult.encoderErrorArray;
                    self.ediTemplateRender(isFromReclaim, result, null, errorResult.commonError, data);
                    $('#divEDIResult, #aDownloadEDI, #liEDI').hide();
                    $('#reclaimEDI, #divErrorMsgs').show();
                } else {
                    $("#btnClaimsRefresh").click();
                }
            },

            /**
             * ediTemplateRender - edi error result
             *
             * @param  {Boolean} isFromReclaim  reclaim flag
             * @param  {Object} result  edi response
             * @param  {Object} ediText  edi text
             * @param  {Object} commonErrorValidation  common error list
             * @param  {Object} data particularly, the remove disabled flag
             */
            ediTemplateRender: function (isFromReclaim, result, ediText, commonErrorValidation, data) {
                var self = this;
                if (isFromReclaim) {
                    $('#modal_div_container').html(
                        self.ediResultTemplate({
                            result: result,
                            ediText: ediText,
                            commonResult: commonErrorValidation,
                            billingRegionCode: app.billingRegionCode
                        }));
                    commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
                    self.initEvent(true);
                } else {
                    data.removeDisabledFlag = false;

                    commonjs.showDialog({
                        header: 'EDI Claim',
                        i18nHeader: 'shared.moduleheader.ediClaims',
                        width: '95%',
                        height: '75%',
                        fromValidate: true,
                        html: self.ediResultTemplate({
                            result: result,
                            ediText: ediText,
                            commonResult: commonErrorValidation,
                            billingRegionCode: app.billingRegionCode
                        }),
                        onShown: function () {
                            self.initEvent(true);
                        },
                        onHide: function () {
                            commonjs.previousValidationResults = null;
                            $('#btnClaimFormat').removeAttr("data-disabled");
                        }
                    });
                }
            }
        });

        return _self;
    });
