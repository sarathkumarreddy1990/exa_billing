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
    'text!templates/app/file-management.html',
    'text!templates/app/ebs-list.html',
    'text!templates/app/ebs-upload.html',
    'text!templates/app/ebs-update.html',
    'text!templates/app/ebs-results.html',
    'text!templates/app/ebs-fixtures.html',
    'text!templates/app/ebs-resourceTypes.html',
    'shared/ohip'

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
              FileManagementHTML,
              EBSListHTML,
              EBSUploadHTML,
              EBSUpdateHTML,
              EBSResultsHTML,
              EBSFixturesHTML,
              EBSResourceTypesHTML,
              ohip
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

        var defaultFilterInfo = {
            "date": {
                "condition": null,
                "preformatted": "Yesterday",
                "durationValue": "",
                "duration": "Hour(s)",
                "fromTime": null,
                "toTime": null,
                "fromDate": null,
                "fromDateTime": null,
                "toDate": null,
                "toDateTime": null,
                "isStudyDate": false,
                "dateType": "claim_dt"
            },
            "patientInformation": {
                "patientName": [],
                "patientID": []
            },
            "studyInformation": {
                "institution": {
                    "list": []
                },
                "modality": {
                    "list": []
                },
                "modality_room_id": {
                    "list": []
                },
                "facility": {
                    "list": []
                },
                "status": {
                    "last_changed_by_me": false,
                    "list": []
                },
                "vehicle": {
                    "list": []
                },
                "bodyPart": {
                    "list": []
                },
                "studyID": {
                    "value": ""
                },
                "accession": {
                    "value": ""
                },
                "stat": {
                    "list": []
                },
                "flag": {
                    "list": []
                },
                "study_description": {
                    "condition": "",
                    "list": []
                },
                "ordering_facility": {
                    "list": []
                },
                "attorney": []
            },
            "physician": {
                "readPhy": [],
                "refPhy": [],
                "imageDelivery": {
                    "condition": "",
                    "list": []
                }
            },
            "insurance": {
                "insProv": []
            },
            "options": {
                "statOverride": false,
                "showDicomStudies": false,
                "showRisOrders": false,
                "showAssignedStudies": false,
                "includeDeleted": null,
                "showEncOnly": false,
                "disableRightClick": false,
                isClaimGrid: true
            }
        };

        var mergeFilters = function (filterIndexSet, overrides) {
            var firstIndex = filterIndexSet.first();
            var firstFilter = commonjs.studyFilters.get(firstIndex);
            var dateFilters = [
                {
                    'name': '-REMOVE DATE CONDITION-',
                    'date': Object.assign({}, defaultFilterInfo.date)
                }
            ];

            var newFilter = {
                'assigned_groups': [],
                'assigned_users': [],
                'back_color': '',
                'display_as_tab': true,
                'display_in_ddl': true,
                'filter_info': firstFilter.filter_info,
                'filter_name': firstFilter.filter_name.trim(),
                'filter_order': 0,
                'fore_color': '',
                'id': null,
                'is_private_filter': true,
                'super_user': app.userInfo.user_type === 'SU',
                'user_id': app.userID,
                'joined_filters': firstFilter.joined_filters
            };

            if (firstFilter.filter_info.date.condition) {
                dateFilters.push({
                    'name': firstFilter.filter_name,
                    'date': firstFilter.filter_info.date
                });
            }
        };
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

        // Backbone.sync = function(method, model) {
        //   console.log(method + ": " + model.url);
        // };


        // var conformanceTestingResult = Backbone.Model.extend({
        //     // method: 'POST',
        //     defaults: {
        //         resourceID: '',
        //         description: '',
        //         status: '',
        //         createdDate: '',
        //         modifiedDate: '',
        //         // resourceType: '',
        //         // postal_code: '',
        //         // isNPPESResult: false
        //     }
        // });

        var flattenDetailResults = function(ebsResponse) {
            return _.reduce(ebsResponse.results, (data, result) => {
                if (result.data) {
                    return data.concat(result.data);
                }
            }, []);
        };

        var ebsListResults = Backbone.Collection.extend({
            url: '/exa_modules/billing/ohip/ct',
            method: 'GET',
            type: 'GET',
            // defaults: {
            //     data: {
            //         service: 'list'
            //     }
            // },
            // model: conformanceTestingResult,
            parse: function(response, options) {
                return flattenDetailResults(response);
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
                "click #btnFileManagement": "showFileManagement",
                "click #btnConformanceTesting": "showConformanceTesting"
            },

            initialize: function (options) {
                this.options = options;
                var self = this;


                this.ebsListResults = new ebsListResults();

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

                commonjs.hideItem('diagnosis-count', '#aDiagnosisCountDropDownItem');
                commonjs.hideItem('insurance-vs-lop', '#aInsuranceLOPDropDownItem');
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
                self.fileManagementTemplate = _.template(FileManagementHTML);
                self.ebsListTemplate = _.template(EBSListHTML);
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
                    showConformanceTesting: true,
                    gadget: '',
                    customStudyStatus: [],
                    customOrderStatus: []
                }));

                if (queryString && !queryString.target && commonjs.getParameterByName(queryString).admin && commonjs.getParameterByName(queryString).admin == 1) {
                    self.isAdmin = true;
                }
                commonjs.showLoading('Loading filters..');
                self.userSettings = commonjs.hstoreParse(app.userInfo.user_settings);
                $("#btnStudiesRefreshAll, .createNewClaim, #btnStudiesRefresh, #btnbatchClaim, #diveHomeIndex, #divclaimsFooter").hide();
                $('#divPageLoading').show();

                isDefaultTab = false;
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
                        })
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
                        columns: ["current_illness_date", "claim_dt", "followup_date", "birth_date", 'submitted_dt', 'first_statement_dt']
                    }
                ];
                var columnsToBind = _.find(drpTabColumnSet,function (val) {
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
                        && (gridObj.options.filterid == 'All_Claims' || gridObj.options.filterid === "Follow_up_queue"))
                        && !colElement.val()) {
                        var toDate = moment(),
                            fromDate = moment().subtract(89, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, rangeSetName, function (start, end, format) {
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
                    colElement.on("apply.daterangepicker", function (ev, drp) {
                        self.refreshClaims(true);
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.datePickerCleared = true;
                        self.refreshClaims(true);
                    });
                    commonjs.isMaskValidate();
                }); // end _.each
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
            createClaims: function (e) {
                var self = this;
                var billingMethodFormat = '';
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

                var filterID = commonjs.currentStudyFilter;
                var filter = commonjs.loadedStudyFilters.get(filterID);

                var claimIds = [], invoiceNo = [], existingBillingMethod = '', existingClearingHouse = '', existingEdiTemplate = '', selectedPayerName = [];

//JAQUA
                for (var i = 0; i < $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked').length; i++) {
                    var rowId = $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked')[i].parentNode.parentNode.id;

                    var claimStatus = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'claim_status_code');

                    if (claimStatus == "PV") {
                        commonjs.showWarning('messages.status.pleaseValidateClaims');
                        return false;
                    }

                    var billingMethod = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'hidden_billing_method');

                    var rowData = $(filter.options.gridelementid).jqGrid('getRowData', rowId);
                    var claimDt = rowData.claim_dt;
                    var futureClaim = claimDt && moment(claimDt).diff(moment(), 'days');

                    if (e.target) {
                        if (billingMethodFormat != billingMethod) {
                            commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                            return false;
                        }
                    }

                    if (app.country_alpha_3_code == "can" && futureClaim > 0 && billingMethodFormat == 'electronic_billing') {
                        commonjs.showWarning('messages.status.futureClaimWarning');
                        return false;
                    }

                    if (existingBillingMethod == '') existingBillingMethod = billingMethod
                    if (existingBillingMethod != billingMethod) {
                        commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                        return false;
                    } else {
                        existingBillingMethod = billingMethod;
                    }

                    var clearingHouse = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'hidden_clearing_house');
                    if (existingClearingHouse == '') existingClearingHouse = clearingHouse;
                    if (app.country_alpha_3_code !== "can" && existingClearingHouse != clearingHouse && billingMethod == 'electronic_billing') {
                        commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfClearingHouseClaims');
                        return false;
                    } else {
                        existingClearingHouse = clearingHouse;
                    }

                    var payerName = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'payer_name');
                    selectedPayerName.push(payerName)

                    // var ediTemplate = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'edi_template');
                    // if (existingEdiTemplate == '') existingEdiTemplate = ediTemplate;
                    // if (existingEdiTemplate != ediTemplate) {
                    //     commonjs.showWarning('Please select claims with same type of  edi template Claims ');
                    //     return false;
                    // } else {
                    //     existingEdiTemplate = ediTemplate;
                    // }
                    var invoice_no = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'hidden_invoice_no');
                    invoiceNo.push(invoice_no);
                    claimIds.push(rowId);
                }


                if (claimIds && claimIds.length == 0) {
                    commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                    return false;
                }

                /// Possible values for template type --
                /// "direct_invoice"
                /// "paper_claim_full"
                /// "paper_claim_original"
                /// "patient_invoice"
                if (existingBillingMethod === 'paper_claim') {
                    var paperClaimFormat =
                        localStorage.getItem('default_paperclaim_format') === 'ORIGINAL'
                            ? 'paper_claim_original' : 'paper_claim_full';

                    paperClaim.print(paperClaimFormat, claimIds);
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
                var uniquePayerName = $.unique(selectedPayerName);

                if (existingBillingMethod === 'direct_billing') {
                    if (uniquePayerName && uniquePayerName.length && uniquePayerName.length > 1) {
                        self.printInvoiceClaim('direct_invoice', claimIds, sortBy)
                        return;
                    }
                    else if (invoiceNo && invoiceNo[0] && invoiceNo[0].length > 0) {
                        paperClaim.print('direct_invoice', claimIds, {
                            sortBy: sortBy,
                            invoiceNo: invoiceNo[0]
                        });
                        return;
                    }
                    else {
                        paperClaim.print('direct_invoice', claimIds, {
                            sortBy: sortBy,
                            invoiceNo: invoiceNo[0]
                        });
                        return;
                    }
                }

                if (existingBillingMethod === 'patient_payment') {
                    paperClaim.print('patient_invoice', claimIds, {
                        sortBy: 'patient_name'
                    });
                    return;
                }

                commonjs.showLoading();
                var url = '/exa_modules/billing/claim_workbench/create_claim';
                if (app.country_alpha_3_code === 'can') {
                    url = '/exa_modules/billing/ohip/submitClaims';
                }

                if ($('#chkStudyHeader_' + filterID).is(':checked')) {
                    self.selectAllClaim(filter, filterID, 'EDI');

                } else {
                    jQuery.ajax({
                        url: url,
                        type: "POST",
                        data: {
                            claimIds: claimIds.toString()
                        },
                        success: function (data, textStatus, jqXHR) {
                            commonjs.hideLoading();
                            self.ediResponse(data);

                        },
                        error: function (err) {
                            commonjs.handleXhrError(err);
                        }
                    });
                }

            },

            selectAllClaim: function (filter, filterID, targetType) {
                var self = this;
                filterData = JSON.stringify(filter.pager.get('FilterData'));
                filterCol = JSON.stringify(filter.pager.get('FilterCol'));

                var isDatePickerClear = filterCol.indexOf('claim_dt') === -1;

                var implUrl = '/exa_modules/billing/claim_workbench';
                if (app.country_alpha_3_code === 'can') {
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
                        }
                    },
                    success: function (data, textStatus, jqXHR) {
                        commonjs.hideLoading();
                        if (targetType == 'EDI') {
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

            ediResponse: function (data) {
                self.ediResultTemplate = _.template(ediResultHTML);
                self.ohipResultTemplate = _.template(ohipResultHTML);

                commonjs.showLoading();

                commonjs.hideLoading();
                data.err = data.err || data.message;
                if (data && data.err) {
                    commonjs.showWarning(data.err);
                }

                if (data && data.ediText && data.ediText.length) {

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
                    if (data.validations && data.validations.length) {
                        result = _.groupBy(data.validations, "dataID");
                    }

                    commonjs.showDialog({
                        header: 'EDI Claim',
                        i18nHeader:'shared.moduleheader.ediClaims',
                        width: '95%',
                        height: '75%',
                        html: self.ediResultTemplate({ result: result, ediText: data.ediTextWithValidations })
                    });
                    $(".popoverWarning").popover();

                    if (data.validations && data.validations.length == 0) {
                        $('#liErrorMessages').css({ 'display': 'none' });
                        $('#aDownloadEDI').css({ 'display': 'block' });
                        $("#btnClaimsRefresh").click();
                        $('#liEDI,#aEDIResp').addClass('active');
                    } else {
                        $('#divEDIResult').css({ 'display': 'none' });
                        $('#divErrorMsgs').css({ 'display': 'block' });
                        $('#aDownloadEDI').css({ 'display': 'none' });
                    }

                    commonjs.initializeScreen({ buttons: [] });
                    $('#tabsEDIResponses li').click(function (e) {
                        if (e.target.id == 'aEDIResp') {
                            $('#liEDI').addClass('active');
                            $('#liErrorMessages').removeClass('active');
                            $('#divErrorMsgs').css({ 'display': 'none' });
                            $('#divEDIResult').css({ 'display': 'block' });
                            if (data.validations && data.validations.length == 0) {
                                $('#aDownloadEDI').css({ 'display': 'block' });
                            }

                        }
                        else {
                            $('#liEDI,#aEDIResp').removeClass('active');
                            $('#liErrorMessages').addClass('active');
                            $('#divEDIResult').css({ 'display': 'none' });
                            $('#divErrorMsgs').css({ 'display': 'block' });
                            $('#aDownloadEDI').css({ 'display': 'none' });
                        }
                    });

                    $('#modal_div_container .downloadEDI').on('click', function () {
                        var element = document.createElement('a');
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data.ediText));
                        element.setAttribute('download', 'edi.txt');

                        element.style.display = 'none';
                        document.body.appendChild(element);

                        element.click();

                        document.body.removeChild(element);
                        $('#modal_div_container .downloadEDI').on('click', function () {
                            self.downloadClaimSubmission(data.ediText, 'edi.txt', 'utf-8');
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

            downloadClaimSubmission: function(fileText, fileName, encoding) {
                var element = document.createElement('a');
                element.setAttribute('href', 'data:text/plain;charset=' + encoding + ',' + encodeURIComponent(fileText));
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
                    success: function(data, response){
                        if (data) {
                            commonjs.hideLoading();

                            if (data && data.length) {
                                commonjs.showDialog({ header: 'Invoice Claim', i18nHeader: 'billing.fileInsurance.invoiceClaim', width: '60%', height: '40%', html: self.invoiceClaim({ response_data: data }) });

                                $(".spnInvoicePrint").click(function (e) {
                                    $(e.target).removeClass("icon-ic-print");
                                    $(e.target).text("Printed").css({ fontSize: "14px" })
                                    var ele = (e.target.id).split('_');
                                    printerClaimids = [];

                                    _.each(ele, function (claimid, index) {
                                        if (claimid != 'spnInvoicePrint') {
                                            printerClaimids.push(parseInt(claimid));
                                        }
                                    });

                                    paperClaimNested.print(invoice_type, printerClaimids, {
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

                // if (commonjs.loadedStudyFilters.size > 0) {
                //     commonjs.loadedStudyFilters.forEach(function (gridObj) {
                //         gridObj.customGridTable.jqGrid('GridUnload');
                //     });
                // }
                commonjs.setFilter(null, null);
                $('#divTabsContainer').show();

                // cache jQuery objects
                var $divTabsContainer = $(document.getElementById('divTabsContainer'));
                var $claimsTabs = $divTabsContainer.find('#claimsTabs');
                var $ulTabCollection = $(document.getElementById('ulTabCollection'));
                var $dataContainer = $(document.getElementById('data_container_home'));
                var $divTabsContainer = $(document.getElementById('divTabsContainer'));
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

                    var finishSetup = function (navState) {
                        var diff;
                        var cookie = (commonjs.getCookieOptions(5) || '').split(/__/);
                        var id = cookie[ 0 ];

                        if (cookie.length > 1) {
                            diff = moment().diff(moment(Number(cookie[ 1 ])), 'minutes');
                        }

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

                                var currentQueue = navState.getState('mergeQueue');
                                var currentSet = currentQueue.get('filterIndexSet');

                                var filterIndex = commonjs.claimsFilters.findIndex(function (filter) {
                                    return filter.filter_id == dataContainerValue;
                                });

                                var updatedIndexSet;
                                if (!currentSet.has(filterIndex)) {
                                    updatedIndexSet = currentSet.add(filterIndex);
                                }
                                else {
                                    updatedIndexSet = currentSet.remove(filterIndex);
                                }

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
                            var $ulTab = $ulTabItems.filter('[data-container="' + dataContainerValue + '"]');
                            var $ulLink = $ulTab.children('a');

                            if ($tab.hasClass('can-merge') && navState.getState('isMerging') === true) {
                                e.preventDefault();
                                e.stopPropagation();

                                var currentQueue = navState.getState('mergeQueue');
                                var currentSet = currentQueue.get('filterIndexSet');

                                var filterIndex = commonjs.studyFilters.findIndex(function (filter) {
                                    return filter.filter_id == dataContainerValue;
                                });

                                var updatedIndexSet;
                                if (!currentSet.has(filterIndex)) {
                                    updatedIndexSet = currentSet.add(filterIndex);
                                }
                                else {
                                    updatedIndexSet = currentSet.remove(filterIndex);
                                }

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

                                // get the width of the UL to fix an IE rendering bug
                                var ulWidth = 0;
                                $claimsTabs.children('li').each(function () {
                                    ulWidth += $(this).outerWidth();
                                });

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
                    var showdeleted = !app.showdeletedstudies ?
                        ' ' :
                        ' studies.has_deleted = false ';
                    $divFiltersContainer.hide();

                    var processOptions = function (info) {
                        return {
                            isDicomSearch: isDicomSearch,
                            isRisOrderSearch: isRisOrderSearch,
                            showEncOnly: showEncOnly,
                            dicomwhere: dicomwhere,
                            isClaimGrid: true
                        };
                    };

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
            setTabContents: function (filterID, isPrior, isDicomSearch, isRisOrderSearch, showEncOnly) {
                var self = this;
                self.datePickerCleared = false // to bind the date by default(three months) -- EXA-11340
                if (filterID) {
                    var filter = commonjs.loadedStudyFilters.get(filterID);
                    commonjs.currentStudyFilter = filterID;

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
                                self.bindDateRangeOnSearchBox(gridObj, 'claims','claim_dt');
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

                            $('#btnValidateExport').off().click(function (e) {
                                $('#btnValidateExport').css('display', 'none');
                                var filter_current_id = $('#claimsTabs').find('.active a').attr('data-container')
                                var filter = commonjs.loadedStudyFilters.get(filter_current_id),
                                    filterData = filter && filter.pager && JSON.stringify(filter.pager.get('FilterData')),
                                    filterCol = filter && filter.pager && JSON.stringify(filter.pager.get('FilterCol'));
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

            afterGridBindclaims: function (dataset, gridObj) {
                $('.ui-jqgrid-bdiv').scrollLeft(commonjs.scrollLeft);
            },

            setRangeFilter: function (filterid) {
                var obj = this.getFilterObject(filterid);
                $('.ranges li').removeClass('active');
                $('#divFilterRange span').html(obj.dateString);
                $("input[name='daterangepicker_start']").val(obj.startDate);
                $("input[name='daterangepicker_end']").val(obj.endDate);
            },

            setGridPager: function (filterID, filterObj, isPending) {
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
                                showdeletedstudies: (app.showdeletedstudies) ? true : false,
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
                        success: function (data, textStatus, jqXHR) {
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
                        success: function (data, textStatus, jqXHR) {
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

                $('input:checkbox[name=showDicom]').prop('checked', filter.options.isDicomSearch ? true : false);
                $('input:checkbox[name=showRis]').prop('checked', filter.options.isRisOrderSearch ? true : false);
                $('#showPreOrder').prop('checked', filter.options.isAuthorizationSearch ? true : false);
                $('#showLeftPreOrder').prop('checked', filter.options.isAuthorizationExpSearch ? true : false)
                $('#hdnShowEncOnly').attr('data-showEncOnly', filter.options.showEncOnly == "true" || filter.options.showEncOnly == true ? true : false);
                $('#showOnlyPhyOrders').prop('checked', filter.options.showOnlyPhyOrders ? true : false)
                $('#showOnlyOFOrders').prop('checked', filter.options.showOnlyOFOrders ? true : false)

                commonjs.hideLoading();
                $('#showDicomStudies').attr('disabled', false);
                $('#showRisOrders').attr('disabled', false);
                $('#showPreOrder').attr('disabled', false);
                $('#showLeftPreOrder').attr('disabled', false);
                $('#showOnlyPhyOrders').removeAttr('disabled');
                $('#showOnlyOFOrders').removeAttr('disabled');

                var totalChargeBillFee = pagerObj.get('TotalChargeBillFee') || '$0';
                var totalClaimBalance = pagerObj.get('TotalClaimBalance') || '$0';
                if (filter.options.isClaimGrid) {
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

                var self = this, dicomwhere = "";
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
                        success: function (resp, textStatus, jqXHR) {
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
                // commonjs.isHomePageVisited = false;
                var filter = commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                // if (!filter) {
                //     self.loadTabContents();
                //     return;
                // }

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
                    success: function (resp, textStatus, jqXHR) {
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
                                var result = response;
                                var fore_color = (result.fore_color) ? result.fore_color : 'black';
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
                var _self = this;
                commonjs.processPostRender({screen: 'Claim Workbench'});
                if(filterID=="Follow_up_queue"){
                    $("#btnInsuranceClaim").hide();
                    $("#btnValidateOrder").hide();
                    $("#btnPaperClaim").hide();
                    $("#btnValidateExport").hide();
                }else{
                    $("#btnPaperClaim").show();
                    $("#btnValidateOrder").show();
                    $("#btnValidateExport").show();
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

            showFileManagement: function (e) {
                var self = this;

                self.fileManagementFiles = new FileManagementCollection();
                self.fileManagementPager = new Pager();

                commonjs.showDialog({
                    header: 'File Managmenet',
                    i18nHeader: 'billing.claims.fileManagement',
                    width: '90%',
                    height: '80%',
                    html: self.fileManagementTemplate()
                });

                setTimeout(function() {
                    self.showFileManagementGrid();
                }, 150);
            },

            showFileManagementGrid: function () {
                var self = this;
                self.fileManagementTable = new customGrid(self.fileManagementFiles.rows, '#tblFileManagement');
                self.fileManagementTable.render({
                    gridelementid: '#tblFileManagement',
                    custompager: self.fileManagementPager,
                    emptyMessage: i18n.get("messages.status.noRecordFound"),
                    colNames: ["","File Name","File Type", "Submitted Date","Acknowledgement Received","Payment Received",""],
                    i18nNames: [
                        "",
                        "billing.claims.fileName",
                        "billing.claims.fileType",
                        "billing.claims.submittedDate",
                        "billing.claims.acknowledgementReceived",
                        "billing.claims.paymentReceived",
                        ""
                    ],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: true, search: false },
                        {
                            name: 'file_name',
                            search: false,
                            width: 100,
                            align: 'center'
                        },
                        {
                            name: 'file_type',
                            search: false,
                            width: 100
                        },
                        {
                            name: 'updated_date_time',
                            search: false,
                            width: 200,
                            formatter: function (value, model, data) {
                                return commonjs.checkNotEmpty(value)
                                    ? commonjs.convertToFacilityTimeZone(app.facilityID, value).format('L LT z')
                                    : '';
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
                            customAction: function (rowID, e) {
                                return false;                            }
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
                            customAction: function (rowID, e) {
                                return false;
                            }
                        },
                        {
                            name: 'apply_button',
                            search: false,
                            sortable: false,
                            width: 150,
                            formatter: function (value, model, data) {
                                return (data.file_type === 'can_ohip_p')
                                    ? '<button i18n="shared.buttons.apply" class="btn btn-primary btn-block btn-apply-file-management"></button>'
                                    : '';
                            },
                            customAction: function (rowID, e) {
                                self.applyFileManagement(rowID);
                            }
                        }
                    ],
                    datastore: self.fileManagementFiles,
                    container: $('#modal_div_container'),
                    sortname: 'file_name',
                    sortorder: 'ASC'
                });

                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe());
            },

// JAQUA
            initEbsListResults: function(dataset) {
                // NOTE took this from providers which uses 'self' ... may still be necessary
                if (dataset.length) {
                    this.ebsListResults = dataset;
                }
            },

            showConformanceTesting: function (e) {
                var self = this;

                if (this.ebsListResults)
                self.conformanceTestingPager = new Pager();

                commonjs.showDialog({
                    header: 'Conformance Testing',
                    i18nHeader: 'billing.claims.conformanceTesting',
                    width: '90%',
                    height: '80%',
                    html: self.ebsListTemplate({
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
                _.forEach($('.ohip_resource_chk:checked'), (checkedResource) => {
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
                return $.ajax({
                    url: '/exa_modules/billing/ohip/ct',
                    type: 'POST',
                    data: {
                        service: service,
                        muid: $("#ohipMUID").val(),
                        resourceIDs: this.getCheckedEBSResourceIDs(),
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
                        // TODO handle error
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
                        // TODO handle error
                    });
                });
            },

            deleteResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_DELETE).then(function(response) {
                    self.handleResourceResult(response);
                }).catch(function(err) {
                    // TODO handle error
                });
            },

            submitResource: function() {
                var self = this;
                this.sendResourceIDsRequest(ohip.services.EDT_SUBMIT).then(function(response) {
                    self.handleResourceResult(response);
                }).catch(function(err) {
                    // TODO handle error
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
                    // TODO handle error
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
                    // TODO handle error
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

                });
            },

            getResourceList: function() {

                var self = this;

                var listParams = {
                    service: 'list',
                    muid: $("#ohipMUID").val(),
                    status: $("#ohipStatus").val(),
                    resourceType: $("#ohipResourceType").val()
                };

                if (!listParams.status) {
                    delete listParams.status;
                }

                if (!listParams.resourceType) {
                    delete listParams.resourceType;
                }

                // TODO: care about page number
                this.ebsListResults.fetch({
                    data: listParams,
                    type: 'GET',
                    success: function(models, response, options) {
                        if (response.error) {
                            commonjs.showError(err);
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
                    },
                    error: function(model, response) {
                        commonjs.showError("not good");
                    }
                });
            },


            showEBSGrid: function () {
                console.log('showing conformance testing grid...');
                var self = this;
                self.conformanceTestingTable = new customGrid(self.ebsListResults, '#tblConformanceTesting');
                self.conformanceTestingTable.render({
                    gridelementid: '#tblConformanceTesting',
                    custompager: self.conformanceTestingPager,
                    emptyMessage: i18n.get("messages.status.noRecordFound"),
                    colNames: ["", "ID", "Description", "Status", "Code", "Message"],
                    // i18nNames: [
                    //     "",
                    //     "billing.claims.fileName",
                    //     "billing.claims.fileType",
                    //     "billing.claims.submittedDate",
                    //     "billing.claims.acknowledgementReceived",
                    //     "billing.claims.paymentReceived",
                    //     ""
                    // ],
                    colModel: [
                        { name: '', index: 'id', key: true, hidden: false, search: false, width: 25,
                            formatter: function (cellvalue, options, rowObject) {
                                return `<input type="checkbox" name="chkResource"  class="ohip_resource_chk" id="chkResource_${rowObject.resourceID}" />`
                            }
                        },
                        {
                            name: 'resourceID',
                            search: false,
                            width: 75,
                            // align: 'center'
                        },
                        {
                            name: 'description',
                            search: false,
                            width: 200
                        },
                        {
                            name: 'status',
                            search: false,
                            width: 150,
                            // formatter: function (value, model, data) {
                            //     return commonjs.checkNotEmpty(value)
                            //         ? commonjs.convertToFacilityTimeZone(app.facilityID, value).format('L LT z')
                            //         : '';
                            // }
                        },
                        {
                            name: 'code',
                            search: false,
                            width: 100,
                            // align: 'center',
                            // formatter: function (value, model, data) {
                            //     return (data.is_acknowledgement_received === "true")
                            //         ? '<i class="fa fa-check" style="color: green" aria-hidden="true"></i>'
                            //         : '<i class="fa fa-times" style="color: red" aria-hidden="true"></i>';
                            // }
                        },
                        {
                            name: 'msg',
                            search: false,
                            width: 250,
                            // align: 'center',
                            formatter: function (value, model, data) {
                                return data.msg || data.message;
                            }
                        },
                        // {
                        //     name: 'code',
                        //     search: false,
                        //     sortable: false,
                        //     width: 150,
                        //     formatter: function (value, model, data) {
                        //         return (data.file_type === 'can_ohip_p')
                        //             ? '<button i18n="shared.buttons.apply" class="btn btn-primary btn-block btn-apply-file-management"></button>'
                        //             : '';
                        //     },
                        //     customAction: function (rowID, e) {
                        //         self.applyFileManagement(rowID);
                        //     }
                        // }
                    ],
                    datastore: self.ebsListResults,
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


            applyFileManagement: function (fileId) {
                console.log(fileId);
                $.ajax({
                    url: "/exa_modules/billing/ohip/applyRemittanceAdvice",
                    type: "POST",
                    data: {
                        edi_files_id: fileId
                    },
                    success: function (data, textStatus, jqXHR) {
                        console.log(data)
                        commonjs.hideDialog()
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
            scrolleventStudies1: function (filterid, divId, studyStatus) {
                var self = this;
                var divid = "#divClaimGrid" + filterid, scrolldiv = "";
                if ($(divid).find("#gview_tblClaimGrid" + filterid)) {
                    scrolldiv = $(divid).find("#gview_tblClaimGrid" + filterid).find(".ui-jqgrid-bdiv");
                }
                scrolldiv.scroll(function (e) {
                    $("#gs_study_status").focusout();
                    $("#" + divId).hide();
                });
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
                    var billingMethod = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'hidden_billing_method');

                    if (app.country_alpha_3_code === 'can') {
                        if (!billingMethod || (billingMethod !== 'electronic_billing' && billingMethod !== 'direct_billing')) {
                            return commonjs.showWarning('messages.status.pleaseSelectValidClaimsMethod');
                        }

                        if (!existingBillingMethod)
                            existingBillingMethod = billingMethod;

                        if (billingMethod != existingBillingMethod) {
                            return commonjs.showWarning('messages.status.pleaseSelectClaimsWithSameTypeOfBillingMethod');
                        }
                    }

                    selectedClaimIds.push(rowId);
                };

                if (!selectedClaimIds.length) {
                    commonjs.showWarning(commonjs.geti18NString("messages.warning.claims.selectClaimToValidate"));
                    return false;
                }

                if ($('#chkStudyHeader_' + filterID).is(':checked')) {
                    self.selectAllClaim(filter, filterID, 'VALIDATE');
                } else {

                    $.ajax({
                        url: '/exa_modules/billing/claim_workbench/validate_claims',
                        type: 'POST',
                        data: {
                            claim_ids: selectedClaimIds,
                            country: app.country_alpha_3_code
                        },
                        success: function (data, response) {
                            $("#btnValidateOrder").prop("disabled", false);
                            if (data) {
                                commonjs.hideLoading();

                                if (data.validClaim_data && data.validClaim_data.rows && data.validClaim_data.rows.length) {
                                    commonjs.showStatus("messages.status.validatedSuccessfully");

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
                                    commonjs.showDialog({ header: 'Validation Results', i18nHeader: 'billing.claims.validationResults', width: '70%', height: '60%', html: self.claimValidation({ response_data: data.invalidClaim_data }) });
                                }
                            }
                        },
                        error: function (err, response) {
                            $("#btnValidateOrder").prop("disabled", false);
                            commonjs.handleXhrError(err, response);
                        }
                    });
                }
            }
        });

        return _self;
    });
