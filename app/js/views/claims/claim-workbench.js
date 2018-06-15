define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'collections/claim-filters',
    'text!templates/claims/claims.html',
    'text!templates/index.html',
    'models/claim-filters',
    'grid',
    'shared/fields',
    'text!templates/claims/ediResult.html'],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              ClaimFiltersCollection,
              ClaimHTML,
              IndexHTML,
              ModelClaimsFilters,
              ClaimsGrid,
              ListFields,
              ediResultHTML) {
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
        return Backbone.View.extend({
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
            ae_titles: [],
            autorefreshInterval: 3000,
            autorefresh: false,
            statusCode: [],
            userSettings: "",
            events: {
                "click #btnClearAllStudy": "clearAllSelectedRows",
                "click #btnSelectAllStudy": "selectAllRows",
                "click #btnInsuranceClaim": "createClaims",
            },

            initialize: function (options) {
                this.options = options;
                var self = this;

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
                self.template = _.template(ClaimHTML);
                self.indexTemplate = _.template(IndexHTML);
                self.$el.html(self.indexTemplate({
                    gadget: '',
                    customStudyStatus: []
                }));


                if (queryString && !queryString.target && commonjs.getParameterByName(queryString).admin && commonjs.getParameterByName(queryString).admin == 1) {
                    self.isAdmin = true;
                }
                commonjs.showLoading('Loading filters..');
                self.userSettings = commonjs.hstoreParse(app.userInfo.user_settings);

                $('#divPageLoading').show();
                $('#diveHomeIndex').hide();
                $('#divclaimsFooter').hide();

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
                            filter_name: "All Claims",
                            filter_order: 0,
                            id: "All_Claims"
                        })
                        claimsFilters.push({
                            assigned_users: null,
                            display_as_tab: true,
                            display_in_ddl: true,
                            filter_id: "Follow_up_queue",
                            filter_info: null,
                            filter_name: "Follow-Up Queue",
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

            bindDateRangeOnSearchBox: function (gridObj, tabtype) {
                var self = this;
                var drpTabColumnSet = [
                    {                        
                        forTab: "claims",
                        columns: ["current_illness_date", "claim_dt", "followup_date","birth_date"]
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
                    colElement.on("cancel.daterangepicker", function (ev, drp) {
                        self.refreshClaims(true);
                    });
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
            createClaims:function () {
                let self=this;
                let filterID = commonjs.currentStudyFilter;
                let filter = commonjs.loadedStudyFilters.get(filterID);

                let claimIds =[],existingBillingMethod='';       

                for (let i = 0; i < $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked').length; i++) {
                    let rowId = $(filter.options.gridelementid, parent.document).find('input[name=chkStudy]:checked')[i].parentNode.parentNode.id;                   
                    
                    var billingMethod = $(filter.options.gridelementid).jqGrid('getCell', rowId, 'billing_method');
                    if (existingBillingMethod == '') existingBillingMethod = billingMethod
                    if (existingBillingMethod != billingMethod||(billingMethod !='electronic_billing')) {
                        commonjs.showWarning('Please select claims with same type of billing method and electronic billing method');
                        return false;
                    }
                    else {
                        existingBillingMethod = billingMethod;
                    }
                    claimIds.push(rowId);
                }


                if(claimIds&&claimIds.length==0){
                    commonjs.showWarning('Please select claims with same type of billing method and electronic billing method');
                    return false;
                }

                self.ediResultTemplate = _.template(ediResultHTML);

                jQuery.ajax({
                    url: "/exa_modules/billing/claimWorkbench/submitClaim",
                    type: "GET",
                    data: {
                        claimIds:claimIds
                    },
                    success: function (data, textStatus, jqXHR) {
                        if (data && data.ediText.length) {
                            let str='';
                            $.each(data.ediText.split('~'), function (index, val) {
                                if (val != '') {
                                    if (index == 0 || index == 1) {
                                        str += "<tr><td style='width: 20px; padding-bottom: 0px;'>" + (0) + "</td><td style='padding-bottom: 0px; border-right: none;'>" + val + "</td></tr>";
                                    }
                                    else {
                                        str += "<tr><td style='width: 20px; padding-bottom: 0px;'>" + (index - 1) + "</td><td style='padding-bottom: 0px; border-right: none;'>" + val + "</td></tr>";
                                    }
                                }
                            })
                            
                            commonjs.showDialog({
                                header: 'EDI Claim',
                                width: '95%',
                                height: '75%',
                                html: self.ediResultTemplate()
                            });
                            $('#tblEDIResp').append(str);
                        }
                    },
                    error: function (err) {
                        commonjs.handleXhrError(err);
                    }
                });
            },
            setFiltertabs: function (filters) {
                var self = this;
                commonjs.showLoading('Fetching data..');

                if (commonjs.loadedStudyFilters.size > 0) {
                    commonjs.loadedStudyFilters.forEach(function (gridObj) {
                        gridObj.customGridTable.jqGrid('GridUnload');
                    });
                }
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

                        // Check for how long tab cookie has been there, if more than 8 hours, use default tab
                        if (( diff === undefined || diff > 480 ) && !isDefaultTab && app.defaultTab) {
                            $link = $claimsTabs.children('#liclaimsTab' + app.defaultTab);
                            if ($link.length > 0) {
                                // Default tab targeted - go there
                                $claimsTabTarget = $link;
                                isDefaultTab = true;
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
                                self.toggleTabContents(2);
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

                            if (showEncOnly) {
                                self.toggleTabContents(5);
                            }
                            else if (
                                dataContainerValue !== 'PS' &&
                                    dataContainerValue !== 'OD'
                                ) {
                                self.toggleTabContents(2);
                            }

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
                            filterid: id.toString(),
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
                                self.bindDateRangeOnSearchBox(gridObj, 'claims');
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
                                'isClaimGrid': true
                            });
                            table.renderStudy();
                        };


                        createStudiesTable();
                    }
                    else {
                        app.listStudies = filter.datastore.map(function (claims) {
                            return claims.id;
                        });
                        self.toggleTabContents(2);
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
                    var url ="/exa_modules/billing/claimWorkbench/claims_total_records";
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
                                isPrior: filterObj.options.isPrior
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
                var curScroll = $('.tab-pane.active .ui-jqgrid-bdiv').scrollTop();
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
                    if (curScroll > 0) {
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
                                    }
                                    // Reset scroll position
                                    $bdiv.scrollTop(curScroll);
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
                else {
                    self.loadTabContents();
                }
                if (typeof callback === 'function') {
                    return callback(filter);
                }
                return filter;
            },
            reprocessConflicts: function () {

                if (window.confirm('Are you sure you want to reprocess the conflicts?')) {
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

            refreshAllStudies: function () {
                var self = this;
                // commonjs.isHomePageVisited = false;
                var filter = commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                if (!filter) {
                    self.loadTabContents();
                    return;
                }

                var $loading = $(document.getElementById('divPageLoading'));
                $loading.show();
                // commonjs.showLoading();

                jQuery.ajax({
                    url: "/usersettings",
                    type: "GET",
                    data: {},
                    success: function (resp, textStatus, jqXHR) {
                        if (resp && resp.usersettings) {
                            app.usersettings = Object.assign({}, app.usersettings, resp.usersettings);
                            var fid = filter.options.filterid;
                            var isprior = filter.options.isPrior;
                            var $currentstudyTab = $(document.getElementById('studyTabs')).find('a').filter('[href="#divClaimGridContainer' + fid + '"]');
                            var isDicomSearch = $currentstudyTab.attr('data-showDicom') === "true";
                            var isRisOrderSearch = $currentstudyTab.attr('data-showRisOrder') === "true";
                            var showEncOnly = $currentstudyTab.attr('data-showEncOnly') === "true";
                            filter.options.isDicomSearch = isDicomSearch;
                            filter.options.isRisOrderSearch = isRisOrderSearch;
                            filter.options.showEncOnly = showEncOnly;
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

            toggleTabContents: function (index) {
                var _self = this;
                commonjs.processPostRender({screen: 'PACS Home'});
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
            }
        });
    });
