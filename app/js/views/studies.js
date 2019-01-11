define(['jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'collections/study-filters',
    'text!templates/studies.html',
    'text!templates/index.html',
    'models/study-filters',
    'grid',
    'shared/fields',
    'views/claims/index'],
    function ($,
              Immutable,
              _,
              Backbone,
              JGrid,
              JGridLocale,
              StudyFiltersCollection,
              StudyHTML,
              IndexHTML,
              modelStudyFilter,
              StudyGrid,
              ListFields,
              claimsView) {
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
                "dateType": "study_dt"
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
                "disableRightClick": false
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
            order_loaded: false,
            routePrefix: '',
            ordersTable: null,
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
                "click #btnStatusApply": "applyStatusFilter",
                "click #btnCancelStatusSearch": "cancelStatusFilterSearch",
                "change #chkAllStatus": "chooseStatusForFilter",
                "change #chkAppointmentStatus": "chooseStatusForFilter",
                "change #chkRadStatus": "chooseStatusForFilter",
                "change #chkStudyProgress": "chooseStatusForFilter",
                "click #btnStudiesRefresh": "refreshStudies",
                "click #btnValidateExport": "underConstruction",
                "click #btnCreateNew": "createNewClaim",
                "click #btnStudiesRefreshAll": "refreshAllStudies",
                "click #btnStudiesCompleteRefresh": "completeRefresh",
                "click #btnClearAllStudy": "clearAllSelectedRows",
                "click #btnSelectAllStudy": "selectAllRows"
            },

            initialize: function (options) {
                this.options = options;
                var self = this;
              //  self.render();
                self.routePrefix = '#home/studies/';

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

                if (app.userInfo.user_type != 'SU') {
                    var rights = (window.appRights).init();
                    this.screenCode = rights.screenCode;
                }
                else {
                    this.screenCode = [];
                }
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
            underConstruction:function(){
                alert("Under construction");
                return false;
            },
            completeRefresh: function (e) {
                var self = this;
                self.render(e);
            },

            render: function (queryString) {
                var self = this;
                self.template = _.template(StudyHTML);
                self.indexTemplate = _.template(IndexHTML);
                self.$el.html(self.indexTemplate({
                    gadget: '',
                    customOrderStatus: app.customOrderStatus,
                    customStudyStatus: app.customStudyStatus
                }));

                $("#btnInsuranceClaim, #btnValidateOrder, #btnValidateExport, #btnClaimsRefresh, #btnClaimRefreshAll, #diveHomeIndex, #divStudyFooter").hide();

                if (queryString && !queryString.target && commonjs.getParameterByName(queryString).admin && commonjs.getParameterByName(queryString).admin == 1) {
                    self.isAdmin = true;
                }
                commonjs.showLoading('Loading filters..');
                self.userSettings = commonjs.hstoreParse(app.userInfo.user_settings);
                isDefaultTab = false;
                self.studyFilters = new StudyFiltersCollection();
                self.studyFilters.fetch({
                    data: {},
                    success: function (model, response) {
                        // if (commonjs.isValidResponse(response)) {
                            var studyFilters = [];
                            studyFilters.push({
                            assigned_users: null,
                            display_as_tab: true,
                            display_in_ddl: true,
                            filter_id: "All_Studies",
                            filter_info: null,
                            filter_name: commonjs.geti18NString("shared.fields.allStudies"),
                            filter_order: 0,
                            id: "All_Studies"
                        });
                        studyFilters = studyFilters.concat(response)
                        commonjs.studyFilters = Immutable.List(studyFilters);
                        self.setFiltertabs(studyFilters);
                        // }

                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
                if (!app.enableEmergencyAccess)
                    $('.emergencyAccess').hide();
                else
                    commonjs.blinkStat('#emergencyAccess', 1500);

                if (self.screenCode.indexOf('CLIM') > -1) {
                    $('#btnCreateNew').attr('disabled', true);
                    $('#btnbatchClaim').attr('disabled', true);
                }

            },

            bindDateRangeOnSearchBox: function (gridObj, tabtype, defaultDateFilter) {
                var self = this;
                var drpTabColumnSet = [
                    {
                        // ALL STUDIES
                        forTab: "study",
                        columns: ["study_received_dt", "study_dt", "check_indate", "approved_dt", "mu_last_updated", "scheduled_dt", "status_last_changed_dt", "birth_date"]
                    }
                ];
                var columnsToBind = _.find(drpTabColumnSet,function (val) {
                    return val.forTab === tabtype;
                }).columns;
                var drpOptions = { locale: { format: "L" } };

                if (commonjs.currentStudyFilter == "0" && self.isFirstTabEnabled) {
                    commonjs.currentStudyFilter = "PS";
                }
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
                    // all columns start with "gs_" and are several levels under "gview_tblGrid{filterId}"
                    var colSelector = "#gview_tblGrid" + gridObj.options.filterid + " " + "#gs_" + col;
                    var colElement = $(colSelector);
                    if (!colElement.length) {
                        return; // skips current iteration only !
                    }


                    if ((!self.datePickerCleared && defaultDateFilter === 'study_dt' && col == 'study_dt'
                        && (gridObj.options.filterid == 'All_Studies'))
                        && !colElement.val()) {
                        var toDate = moment(),
                            fromDate = moment().subtract(29, 'days');
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
                        self.refreshStudies(true);
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.datePickerCleared = true;
                        self.refreshStudies(true);
                    });
                    commonjs.isMaskValidate();
                }); // end _.each
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
                var $studyTabs = $divTabsContainer.find('#studyTabs');
                var $ulTabCollection = $(document.getElementById('ulTabCollection'));
                var $dataContainer = $(document.getElementById('data_container_home'));
                var $divTabsContainer = $(document.getElementById('divTabsContainer'));
                var $divFiltersContainer = $(document.getElementById('divFiltersContainer'));
                var $lblShowPrior = $(document.getElementById('lblShowPrior'));
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

                        var $studyTabsItems = $studyTabs.children('li');
                        var $studyTabTarget = $studyTabsItems.eq(0);
                        var $link;

                        if (app.default_study_tab) {
                            $link = $studyTabs.children('#liStudyTab' + app.default_study_tab);
                            if ($link.length > 0) {
                                // Default tab targeted - go there
                                $studyTabTarget = $link;
                            }
                        }
                        if (( typeof $link === 'undefined' || $link.length === 0 ) && id.length > 0) {
                            // Otherwise use cookie
                            $link = $studyTabs.children('#liStudyTab' + id);
                            if ($link.length > 0) {
                                $studyTabTarget = $link;
                            }
                        }
                        $studyTabTarget.children('a').click();

                    }.bind(null, navState);

                    var setClickEvents = function (navState, callback) {
                        commonjs.hideLoading();
                        var $pagination = $divPager.find('.pagination');
                        var $studyTabsItems = $studyTabs.children('li');
                        var $studyTabsLinks = $studyTabsItems.children('a');
                        $ulTabCollection.on('click', 'li', function (e) {
                            var target = e.currentTarget;
                            var $target = $(target);
                            var dataContainerValue = target.getAttribute('data-container');
                            var $studyTabsItems = $studyTabs.children('li');
                            var $studyTabsLinks = $studyTabsItems.children('a');
                            var $link = $studyTabsLinks.filter('[data-container="' + dataContainerValue + '"]');

                            if ($target.hasClass('can-merge') && navState.getState('isMerging') === true) {
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

                            switch (dataContainerValue) {
                                case 'SU':
                                    $link.click();
                                    break;
                                default:
                                    var studyTabID = '[href="#divGridContainer' + dataContainerValue + '"]';
                                    var $targetStudyTab = $studyTabsLinks.filter(studyTabID);
                                    if ($targetStudyTab.length > 0) {
                                        //$targetStudyTab.show();
                                        $targetStudyTab.click();
                                    }
                                    break;
                            }
                        });

                        $studyTabsLinks.on("click", function (e) {
                            var target = e.currentTarget;
                            var $target = $(target);
                            var $tab = $target.parent();
                            var dataContainerValue = target.getAttribute('data-container');
                            var $studyTabsItems = $studyTabs.children('li');
                            var $studyTabsLinks = $studyTabsItems.children('a');
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
                            $studyTabsLinks.css('border-top', '');
                            $studyTabsItems.css('margin-bottom', '');
                            if (dataContainerValue) {
                                $lblShowPrior.show();
                                self.toggleTabContents(2);
                                var studyTabID = '[href="#divGridContainer' + dataContainerValue + '"]';
                                var $studyTabTarget = $studyTabsLinks.filter(studyTabID);
                                var borderWidth = '3px !important';
                                if ($studyTabTarget.length > 0 && $studyTabTarget.attr('style') && /background/.test($studyTabTarget.attr('style'))) {
                                    $studyTabTarget
                                        .css({
                                            'border-top-width': borderWidth,
                                            'border-top-color': $studyTabTarget[ 0 ].style.backgroundColor + ' !important'
                                        })
                                        .closest('li')
                                        .css('margin-bottom', '-' + borderWidth);
                                }
                            }
                            if ($studyTabTarget) {
                                var isDicomSearch = $studyTabTarget.attr('data-showDicom') === "true";
                                var isRisOrderSearch = $studyTabTarget.attr('data-showRisOrder') === "true";
                                var showEncOnly = $studyTabTarget.attr('data-showEncOnly') === "true";
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
                            $studyTabsItems.removeClass("active");
                            $("#liStudyTab"+dataContainerValue).addClass("active");
                            $('#tblGrid' + dataContainerValue).first().children().first().addClass('dg-body');
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
                                $(document.getElementById('chkStudyHeader_' + commonjs.currentStudyFilter)).prop('checked', false);
                                self.navigateRecords(commonjs.currentStudyFilter, e.currentTarget.getAttribute('data-container'));
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
                                $studyTabs.children('li').each(function () {
                                    ulWidth += $(this).outerWidth();
                                });

                                var visible = $divTabsContainer.width();
                                // var currPos = $studyTabs.position().left;
                                var currPos = navState.getState('leftPosition');
                                var remains = -currPos;
                                var nextPos = getPosition($studyTabs, currPos + visible * 0.8);
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

                                    $studyTabs.css({
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
                                $studyTabs.children('li').each(function () {
                                    ulWidth += $(this).outerWidth();
                                });

                                var visible = $divTabsContainer.width();
                                // var currPos = $studyTabs.position().left;
                                var currPos = navState.getState('leftPosition');
                                var nextPos = getPosition($studyTabs, currPos - visible * 0.8);
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

                                    $studyTabs.css({
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
                    $studyTabs.html(elements.studyTabs.join(''));
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
                    $lblShowPrior.hide();

                    var processOptions = function (info) {
                        if (info && info.options) {
                            var options = info.options;
                            var isDicomSearch = typeof options.showDicomStudies === 'boolean' ?
                                options.showDicomStudies :
                                false;
                            var isRisOrderSearch = typeof options.showRisOrders === 'boolean' ?
                                options.showRisOrders :
                                false;
                            var showEncOnly = typeof options.showEncOnly === 'boolean' ?
                                options.showEncOnly :
                                false;
                            if (showEncOnly) {
                                var dicomwhere = " AND (order_type='E')";
                            }
                            else {
                                if (isDicomSearch && isRisOrderSearch) {
                                    dicomwhere = " AND (COALESCE(dicom_status,'') in ('CO','IP','NA',''))";
                                }
                                else if (isDicomSearch) {
                                    dicomwhere = " AND (dicom_status in ('CO','IP'))";
                                }
                                else if (isRisOrderSearch) {
                                    dicomwhere = " AND (COALESCE(dicom_status,'') in ('NA',''))";
                                }
                                else {
                                    dicomwhere = "";
                                }
                            }
                        }
                        return {
                            isDicomSearch: isDicomSearch,
                            isRisOrderSearch: isRisOrderSearch,
                            showEncOnly: showEncOnly,
                            dicomwhere: dicomwhere
                        };
                    };

                    var processFilters = function (arrays, data) {
                        var id = data.filter_id;
                        var name = data.filter_name;
                        var info = data.filter_info;
                        var options = processOptions(info);
                        var liStudyTab = [
                            '<li id="liStudyTab',
                            id,
                            '"',
                            (!data.display_as_tab ?
                                ' style="display:none"' :
                                ''),
                            ' class="nav-item',
                            (info ? ' can-merge' : ''),
                            '"><a href="#divGridContainer',
                            id,
                            '" data-container="',
                            id,
                            '"class="nav-link"',
                            '" data-showDicom="',
                            options.isDicomSearch,
                            '" data-showRisOrder="',
                            options.isRisOrderSearch,
                            '" data-showEncOnly="',
                            options.showEncOnly,
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
                            filterid: id,
                            dicomwhere: options.dicomwhere,
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
                        arrays.studyTabs.push(liStudyTab);
                        arrays.ulTabCollection.push(liTab);
                        return arrays;
                    };

                    var initialTabs = function () {
                        var filterQueries = [];
                        var dataContainer = [];
                        var studyTabs = [];
                        var ulTabCollection = [];


                        return {
                            filterQueries: filterQueries,
                            dataContainer: dataContainer,
                            studyTabs: studyTabs,
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
                                $('#chkStudyHeader_' + filterID).prop('checked', false);
                                self.setGridPager(filterID, gridObj, false);
                                self.bindDateRangeOnSearchBox(gridObj, 'study' ,'study_dt');
                                self.afterGridBindStudy(model, gridObj);
                                self.initializeStatusCodes(gridObj, 'study');
                                commonjs.nextRowID = 0;
                                commonjs.previousRowID = 0;
                                app.listStudies = gridObj.datastore.map(function (study) {
                                    return study.id;
                                });
                                commonjs.setFilter(filterID, gridObj);
                            };
                            var table = new StudyGrid({
                                'isAdmin': self.isAdmin,
                                'gridelementid': '#tblGrid' + filterID,
                                'filterid': filterID,
                                'setpriorstudies': '',
                                'isPrior': false,
                                'isDicomSearch': false,
                                'providercontact_ids': app.providercontact_ids,
                                'searchByAssociatedPatients': '',
                                'isRisOrderSearch': false,
                                'showEncOnly': false,
                                'study_id': 0,
                                'container': self.el,
                                '$container': self.$el,
                                'updateStudiesPager': updateStudiesPager
                            });
                            table.renderStudy();

                            $("#btnbatchClaim").off().click(function (e) {
                                table.batchClaim();
                            });

                        };


                        createStudiesTable();
                    }
                    else {
                        app.listStudies = filter.datastore.map(function (study) {
                            return study.id;
                        });
                        self.toggleTabContents(2);
                        self.setFooter(filter);

                        // Auto Refresh the preloaded grid immediately
                        self.refreshStudies(undefined, undefined, filter, function (filter) {
                            commonjs.setFilter(filterID, filter);
                        });
                    }
                }

                // SMH Bug #2606 - Hides icons if necessary when setting up the table.
                //commonjs.toggleGridlistColumns();
            },

            afterGridBindStudy: function (dataset, gridObj) {
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
                    var url ="/exa_modules/billing/studies/studies_total_records";
                    var flag = /ExceedStudy/.test(filterID);
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
                                flag: 'home_study',
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
                                patient_id: filterObj.options.isPrior ? $('#studyTabs').find('.active a').attr('data-patient_id') : (commonjs.prior_patient_id > 0) ? commonjs.prior_patient_id : 0,
                                study_dt: (commonjs.prior_study_dt) ? commonjs.prior_study_dt : null,
                                order_id: commonjs.prior_order_id ? commonjs.prior_order_id : 0,
                                showOnlyPhyOrders: $('#showOnlyPhyOrders').prop('checked'),
                                showOnlyOFOrders: $('#showOnlyOFOrders').prop('checked'),
                                isPrior: filterObj.options.isPrior,
                                isDatePickerClear: self.datePickerCleared
                            }

                        },
                        success: function (data, textStatus, jqXHR) {
                            if (data&&data.length) {
                                filterObj.pager.set({
                                    "TotalRecords": data[0].total_records
                                });

                                filterObj.setPagerInfos();
                                filterObj.options.isSearch = false;
                                if (filterID === commonjs.currentStudyFilter) {
                                    self.setFooter(filterObj);
                                    commonjs.setFilter(filterID, filterObj);
                                    commonjs.docResize();
                                }

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
                if (/^ExceedStudy.*/.test(filter.options.filterid)) {
                    totalRecords = pagerObj.get('ExceedStudies');
                }

                var pageSize = parseInt(pagerObj.get('PageSize'));
                var startIndex = ((pagerObj.get('PageNo') - 1) * pageSize) + 1;
                var endIndex = ((startIndex + pageSize - 1) > totalRecords) ? totalRecords : (startIndex + pageSize - 1);
                $('#spnTotalRecords').html(totalRecords);
                $('#spnExceedsTime').html(pagerObj.get('ExceedStudies'));
                $('#spnCurrentPage').html(1);
                $('#spnTotalPage').html(endIndex);
                $("#divStudyFooter #divPager .pagination li").removeClass("disabled");
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
                var filter = commonjs.loadedStudyFilters.get(filterID);
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

            refreshStudies: function (isFromDatepicker, IsUnload, filter, callback) {

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
                if ($('input:checkbox[name=showDicom]').prop('checked')) {
                    dicomwhere = " AND (dicom_status='CO' OR dicom_status='IP')"
                }
                else if ($('input:checkbox[name=showRis]').prop('checked')) {
                    dicomwhere = " AND ( dicom_status='NA' OR dicom_status='' OR dicom_status IS NULL )"
                }

                if ($('input:checkbox[name=showRis]').prop('checked') && $('input:checkbox[name=showDicom]').prop('checked')) {
                    dicomwhere = " AND (dicom_status='CO' OR dicom_status='IP' OR  dicom_status='NA' OR dicom_status='' OR dicom_status IS NULL )"
                }

                // Reset Interval, Auto Refresh the grid every 60 seconds
                // clearInterval(self.autoRefreshTimer);

                filter = filter || commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                if (filter) {
                    var $tblGrid = filter.customGridTable || $(filter.options.gridelementid);
                    var $currentStudyTab = $(document.getElementById('studyTabs')).find('a').filter('[href="#divGridContainer' + commonjs.currentStudyFilter + '"]');
                    var isDicomSearch = $currentStudyTab.attr('data-showDicom') == "true";
                    var isRisOrderSearch = $currentStudyTab.attr('data-showRisOrder') == "true";
                    var showEncOnly = $currentStudyTab.attr('data-showEncOnly') == "true";

                    filter.options.customargs.isDicomSearch = filter.options.isDicomSearch = isDicomSearch;
                    filter.options.customargs.isRisOrderSearch = filter.options.isRisOrderSearch = isRisOrderSearch;
                    filter.options.customargs.isAuthorizationSearch = filter.options.isAuthorizationSearch = $('#showPreOrder').is(':checked');
                    filter.options.customargs.isAuthorizationExpSearch = filter.options.isAuthorizationExpSearch = $('#showLeftPreOrder').is(':checked');
                    filter.options.customargs.isDatePickerClear = self.datePickerCleared;

                    if ($('#showPreOrder').is(':checked') || $('#showLeftPreOrder').is(':checked')) {
                        filter.options.customargs.showOnlyPhyOrders = filter.options.showOnlyPhyOrders = false;
                        filter.options.customargs.showOnlyOFOrders = filter.options.showOnlyOFOrders = false;
                    }
                    else {
                        filter.options.customargs.showOnlyPhyOrders = filter.options.showOnlyPhyOrders = $('#showOnlyPhyOrders').is(':checked');
                        filter.options.customargs.showOnlyOFOrders = filter.options.showOnlyOFOrders = $('#showOnlyOFOrders').is(':checked');
                    }

                    filter.options.customargs.showEncOnly = filter.options.showEncOnly = showEncOnly;
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
                        $tblGrid.jqGrid("setGridParam", {
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
                                        $tblGrid.jqGrid("setGridParam", {
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

                if (window.confirm('Are you sure you want to reprocess the conflicts?')) {
                    var self = this;
                    commonjs.showLoading();
                    jQuery.ajax({
                        url: "/qc/reprocess_conflicts",
                        type: "PUT",
                        data: {},
                        success: function (resp, textStatus, jqXHR) {
                            commonjs.hideLoading();
                            self.refreshStudies(true);
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
                    return;
                }

                var $loading = $(document.getElementById('divPageLoading'));
                $loading.show();
                commonjs.showLoading();

                jQuery.ajax({
                    url: "/exa_modules/billing/user_settings",
                    type: "GET",
                    data: {
                        gridName: 'studies'
                    },
                    success: function (resp, textStatus, jqXHR) {
                        resp = resp && (resp.length >=1) && resp[1].rows && resp[1].rows[0] ? resp[1].rows[0] : {};
                        if (resp) {
                            app.study_user_settings = Object.assign({}, app.study_user_settings, resp);
                            var fid = filter.options.filterid;
                            var isprior = filter.options.isPrior;
                            var $currentstudyTab = $(document.getElementById('studyTabs')).find('a').filter('[href="#divGridContainer' + fid + '"]');
                            var isDicomSearch = $currentstudyTab.attr('data-showDicom') === "true";
                            var isRisOrderSearch = $currentstudyTab.attr('data-showRisOrder') === "true";
                            var showEncOnly = $currentstudyTab.attr('data-showEncOnly') === "true";
                            filter.options.isDicomSearch = isDicomSearch;
                            filter.options.isRisOrderSearch = isRisOrderSearch;
                            filter.options.showEncOnly = showEncOnly;
                            filter.customGridTable.jqGrid('GridUnload');
                            commonjs.setFilter(null, null);
                            self.setTabContents(fid, isprior, isDicomSearch, isRisOrderSearch, showEncOnly);
                            commonjs.hideLoading();
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
                this.studyFiltersModel = new modelStudyFilter();
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
                                var currentstudyTabID = '#studyTabs a[href="#divGridContainer' + filterID + '"]';
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
                commonjs.processPostRender({screen: 'Studies'});
                $('#divPageLoading').hide();
                $('#diveHomeIndex').show();
                $('#divStudyFooter').show();
                $("#divStudyFooter").show();
                $("#divStudyFooterSetup").show();
                $("#divStudyFooterSetup :button").show();
                $("#divReprocessConflicts").hide();
                $("#divFilterType").show();
                $('#divCountTatStat').show();
                $('#divshowcheckStudies').show();
                $('#btnNoneStudy').show();
                $('#btnAllStudy').show();
                $('#spnExceedsTime').show();
                $('#spLabelExceedsTime').show();
                $('#showPreOrderControls').hide();
                $('#showStudyFilterControl').hide();
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
            initializeStatusCodes: function (gridObj, tabtype) {
                var self = this;
                $('.statusMenu').hide();
                $('#divStatusSearch').find('input[type=checkbox]:checked').removeAttr('checked');

                var sch_date = $(gridObj.options.gridelementid).closest("div.ui-jqgrid-view")
                    .children("div.ui-jqgrid-hdiv").find('#gs_scheduled_dt');
                sch_date.prop("readonly", true);
                sch_date.css('cursor', 'pointer')
                var study_status = $(gridObj.options.gridelementid).closest("div.ui-jqgrid-view")
                    .children("div.ui-jqgrid-hdiv").find('#gs_study_status');
                study_status.prop("readonly", true);
                study_status.css('cursor', 'pointer');
                study_status.unbind('click').click(function (e) {

                    $("#divStatusSearch").show();
                    $("#divStatusSearch").css({
                        "top": study_status.offset().top + 25 + "px",
                        "left": study_status.offset().left + "px"
                    });
                    $('#divStatusSearch').find('input[type=checkbox]:checked').removeAttr('checked');

                    var filter = commonjs.loadedStudyFilters.get(commonjs.currentStudyFilter);
                    var status = filter.options.customargs.statusCode || [];
                    for (var j = 0; j < status.length; j++) {

                        $('#divStatusSearch').find('input[type=checkbox][value=' + status[j] + ']').prop("checked", true);
                    }
                    self.setStudyStatus();
                    e.stopPropagation();
                    return false;
                });

                self.scrolleventStudies1(commonjs.currentStudyFilter, 'divStatusSearch', study_status);

                $(".status").change(function () {
                    self.setStudyStatus();
                });
            },
            setStudyStatus: function () {
                if ($('#ulAppointmentStatus .status').length == $('#ulAppointmentStatus .status:checked').length) {
                    $('#chkAppointmentStatus').prop('checked', true);
                }
                else {
                    $('#chkAppointmentStatus').prop('checked', false);
                }
                if ($('#ulStudyProgress .status').length == $('#ulStudyProgress .status:checked').length) {
                    $('#chkStudyProgress').prop('checked', true);
                }
                else {
                    $('#chkStudyProgress').prop('checked', false);
                }
                if ($('#ulRadStatus .status').length == $('#ulRadStatus .status:checked').length) {
                    $('#chkRadStatus').prop('checked', true);
                }
                else {
                    $('#chkRadStatus').prop('checked', false);
                }
                if ($('#divStatusSearch .status').length == $('#divStatusSearch .status:checked').length) {
                    $('#chkAllStatus').prop('checked', true);
                }
                else {
                    $('#chkAllStatus').prop('checked', false);
                }
            },
            scrolleventStudies1: function (filterid, divId, studyStatus) {
                var self = this;
                var divid = "#divGrid" + filterid, scrolldiv = "";
                if ($(divid).find("#gview_tblGrid" + filterid)) {
                    scrolldiv = $(divid).find("#gview_tblGrid" + filterid).find(".ui-jqgrid-bdiv");
                }
                scrolldiv.scroll(function (e) {
                    $("#gs_study_status").focusout();
                    $("#" + divId).hide();
                });
            },
            applyStatusFilter: function () {
                var self = this;
                var study_status;
                var divID = "#divStatusSearch";
                self.statusCode = [];

                study_status = $('#tblGrid' + commonjs.currentStudyFilter).closest("div.ui-jqgrid-view")
                    .children("div.ui-jqgrid-hdiv").find('#gs_study_status');
                study_status.val('');
                var studyTabID = '#studyTabs a[href="#divGridContainer' + commonjs.currentStudyFilter + '"]';
                var showEncOnly = $(studyTabID).attr('data-showEncOnly') == "true";
                if (showEncOnly) {
                    divID = "#divEncStatusSearch";
                }

                $(divID + " .status:checked").each(function (index, obj) {
                    if ($(".status:checked").length == 1) {
                        study_status.val($(this).attr('data-value'));
                    }
                    else {
                        if (commonjs.checkNotEmpty(study_status.val())) {
                            var status = study_status.val() + ',' + $(this).attr('data-value');
                        }
                        else {
                            var status = $(this).attr('data-value');
                        }
                        study_status.val(status);
                    }
                    if (commonjs.currentStudyFilter != "PS") {
                        self.statusCode.push($(this).val());
                    }
                });

                commonjs.setFilter(commonjs.currentStudyFilter, function (filter) {
                    filter.options.customargs.statusCode = self.statusCode;
                    return filter;
                });
                self.refreshStudies(true);
                $('.statusMenu').hide();
            },

            cancelStatusFilterSearch: function () {
                var self = this;
                var study_status = $('#tblGrid' + commonjs.currentStudyFilter).closest("div.ui-jqgrid-view")
                    .children("div.ui-jqgrid-hdiv").find('#gs_study_status');
                study_status.val('');
                $('#divStatusSearch').find('input[type=checkbox]:checked').prop('checked',false)
                commonjs.setFilter(commonjs.currentStudyFilter, function (filter) {
                    filter.options.customargs.statusCode = [];
                    return filter;
                });
                $("#divStatusSearch").hide();
                self.refreshStudies();
            },
            chooseStatusForFilter: function (e) {
                var self = this;
                var checkBoxContainerID = '';
                switch ($(e.target || e.srcElement).attr('id')) {
                    case 'chkAllStatus':
                        checkBoxContainerID = 'divStatusSearch';
                        break;
                    case 'chkStudyProgress':
                        checkBoxContainerID = 'ulStudyProgress';
                        break;
                    case 'chkRadStatus':
                        checkBoxContainerID = 'ulRadStatus';
                        break;
                    case 'chkAppointmentStatus':
                        checkBoxContainerID = 'ulAppointmentStatus';
                    break;
                }
                $('#' + checkBoxContainerID + ' :checkbox').prop("checked", $(e.target || e.srcElement).prop("checked"));
                if ($('#divStatusSearch .status').length == $('#divStatusSearch .status:checked').length) {
                    $('#chkAllStatus').prop('checked', true);
                }
                else {
                    $('#chkAllStatus').prop('checked', false);
                }
            },

            createNewClaim: function () {
                var self = this;
                self.claimView = new claimsView();
                self.claimView.showPatientForm();
            }
        });
    });
