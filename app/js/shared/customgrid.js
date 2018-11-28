function customGrid ( datastore, gridID ) {
    var self = this;
    self.options = null;
    self.pager = null;
    self.fromDate = null;
    self.toDate = null;
    self.datastore = datastore || null;
    self.grid = gridID ? $(gridID) : null;
    self.iconsToBeHighlighted = [];
    self.pagingFooter = null;
    self.scrollingflag = false;
    self.firstTime = true;
    /**
     * getData - Function to handle grabbing data in a row on the grid.
     * @param {Object}          store
     * @param {string}          tableID
     * @returns {Function}
     */
    var getData = function ( store, tableID ) {
        /**
         * getData(inner)
         * @param {string|number}   id
         * @param {Object}          [searchObj]
         * @returns {Object}
         */
        return function ( id, searchObj ) {
            var model = store.get(id) || searchObj && store.findWhere(searchObj);
            var data = model && model.toJSON() || tableID && $(tableID).jqGrid('getRowData', id) || null;
            if ( data === null || typeof data === 'object' && Object.keys(data).length === 0 ) {
                commonjs.showError('Error getting data for row - ID: ' + id);
                console.log('getData - ID: ', id, ' | store: ', store);
            }
            return data;
        };
    };

    self.render = function ( options ) {
        self.options = options;
        self.pager = options.custompager;
        if ( self.datastore === null ) {
            self.datastore = options.datastore;
        }
        self.datastore.off();
        self.getData = getData(self.datastore, options.gridelementid);
        self.fromDate = options.fromDate || null;
        self.toDate = options.toDate || null;
        self.pager.set("PageSize", self.firstTime ? 100 : self.getRowCount());
        self.pager.set("PageNo", self.firstTime ? 1 : parseInt(self.pager.get('PageNo')));
        var $tblGrid = self.grid || (options.$container || $(options.container)).find(options.gridelementid);
        self.options.grid = $tblGrid;
        if ( $tblGrid.length > 0 ) {
            $tblGrid[ 0 ].customGrid = self;
        }

        self.options.i18nNames = (self.options.subGrid)? [''].concat(self.options.i18nNames) : self.options.i18nNames;

        jq_isWidthResize = options.disableautowidthresize;
        jq_isHeightResize = options.disableautoheightresize;
        jq_userWidth = options.width;
        jq_userHeight = options.height;
        jq_offsetWidth = options.offsetWidth;
        jq_offsetheight = options.offsetHeight;


        var widHei = commonjs.getGridMeasures(options.disableautowidthresize, options.disableautoheightresize, options.width, options.height, options.offsetWidth, options.offsetHeight);
        var width = widHei.width, height = widHei.height;

        //Added for adjusting Search, Paging size with Table Size
        if ( options.autoAdjustHeight )
            height += 80;

        if ( options.isSubGrid ) {
            height = '100%';
            width = options.disableautowidthresize ? width : undefined;
        }

        var sortableType = false;
        if ( !options.isSubGrid ) {
            sortableType = options.customizeSort ? options.sortable : true;
        }

        self.customGridTable = options.grid.jqGrid({
            datatype: function () {},
            loadonce: true,
            width: width,
            height: 'auto',
            hoverrows:false,
            colNames: options.colNames,
            colModel: options.colModel,
            i18nNames: options.i18nNames,
            pager: $(options.pager),
            rowNum: 100,
            sortable: sortableType,
            sortname: options.sortname,
            sortorder: options.sortorder,
            gridview: true,
            altRows: true,
            subGrid: this.options.subGrid,
            pgbuttons: false,
            viewrecords: !options.disablepaging,
            shrinkToFit: this.options.shrinkToFit,
            pgtext: "",
            cmTemplate: {
                sortable: !options.disablesort,
                searchoptions: {
                    clearSearch: false,
                    attr: {
                        style: "width:100%;padding:0 !important;border-radius: 0px;"
                    }
                }
            },

            subGridRowExpanded: options.subGridInstance,
            beforeRequest: options.beforeRequest,
            subGridRowColapsed: function () {
                $('.divInstanceDicoms').hide();
            },

            resizeStop: function ( newWidth, index ) {
                if ( typeof self.options.resizeStop === "function" ) {
                    self.options.resizeStop(newWidth, index, this);
                }
            },

            beforeSelectRow: function ( rowid, e ) {
                var regScreenFrom = /report|familyHistory|newOrder|editOrder/;
                var regGridID = /tableProvider|tbl(?:GridCpt|InsuranceProvidersGrid|ProviderGroups|VehicleRegionGrid)/;
                var $chkSendStudy = $tblGrid.find('#chk'+self.options.gridelementid.slice(1)+'_'+ rowid);
                self.options.colModel = $tblGrid.jqGrid('getGridParam', 'colModel');
                var rowObj = $(e.target).closest("tr");
                var eitherTarget = $(e.target || e.srcElement);
                var args = self.options.customargs;
                if ( eitherTarget.hasClass('ui-icon') || eitherTarget.parent().hasClass('ui-icon') ) {
                    rowObj.removeClass('customRowSelect').addClass('customRowSelect');
                }
                else {
                    if ( args && regScreenFrom.test(args.screenFrom) && regGridID.test(self.options.gridelementid) ) {
                        $tblGrid.find('.customRowSelect').removeClass('customRowSelect');
                        rowObj.removeClass('customRowSelect').addClass('customRowSelect');
                    }
                    else {
                        rowObj.toggleClass('customRowSelect');
                    }
                }


                if ( $chkSendStudy.length > 0 && (e.target || e.srcElement).type !== 'checkbox' ) {
                    $chkSendStudy.prop('checked', !$chkSendStudy.is(':checked'));
                }

                if ($tblGrid.find('input[name=chkStudy]:checked').length === $tblGrid.find('input[name=chkStudy]').length) {
                    $('#chkStudyHeader_' + self.options.filterid).prop('checked', true);
                } else {
                    $('#chkStudyHeader_' + self.options.filterid).prop('checked', false);
                }

                if ( typeof self.options.beforeSelectRow === "undefined" ) {

                    var i = self.options.subGrid ? (e.target || e.srcElement).parentNode.cellIndex : (e.target || e.srcElement).parentNode.cellIndex;

                    if ( i > -1 ) {

                        if (typeof(self.options.colModel[i].customAction) != "undefined") {
                            self.options.colModel[i].customAction(rowid, e, self);
                            if ($chkSendStudy) {
                                if ($chkSendStudy.length > 0 && ((e.target || e.srcElement).type != 'checkbox')) {
                                    $chkSendStudy.prop('checked', true);
                                }
                            }
                        } else {
                            if (!($tblGrid.find('#' + rowid).find('.linkSpan').length > 0)) {
                                Backbone.history.navigate(self.options.colModel[i].route + rowid, true);
                            }
                        }
                    }
                } else {
                    self.options.beforeSelectRow(rowid, e, self.options);
                }
            },

            onRightClickRow: function (rowid, iRow, iCell, e) {
                if ( typeof self.options.onRightClickRow !== "undefined" ) {
                    // $('.customRowSelect').removeClass('customRowSelect');
                    var tr = $tblGrid.jqGrid("getInd", rowid, true);

                    var rowObj = $(tr);

                    rowObj.removeClass('customRowSelect');
                    var $chkSendStudy = $tblGrid.find('#chkSendStudy_' + rowid);
                    if ( $chkSendStudy.length > 0 && (e.target || e.srcElement).type !== 'checkbox' ) {
                        if ( !$chkSendStudy.prop('checked') ) {
                            $tblGrid.find('input').filter('[type=checkbox]').removeAttr('checked');
                            $tblGrid.find('.customRowSelect').removeClass('customRowSelect');
                        }
                    }
                    $chkSendStudy.prop('checked', true);
                    rowObj.addClass('customRowSelect');
                    self.options.onRightClickRow(rowid, iRow, iCell, e, self.options);
                }
            },

            gridComplete: function() {
                    commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                if (typeof self.options.onGridComplete !== 'undefined' && typeof self.options.onGridComplete === 'function') {
                    self.options.onGridComplete(self, self.options.currentObject);
                }
            },

            loadComplete: function (data) {
                //Added for Query&Retrieve Paging update when new row gets inserted
                if ( typeof options.onaftergridrowbindQR !== 'undefined' && typeof options.onaftergridbind === 'function') {
                    self.pager.set({
                        'TotalRecords': 0,
                        'LastPageNo': 0
                    });
                    self.options.onaftergridbind(null, self, {pager: self.pager}, options.currentObject);
                }
            },

            loadError: function (xhr, status, error) {
                alert('grid loading error' + error);
            },

            ondblClickRow: function (rowid, iRow, iCol, e) {
                $('.rowSelected').removeClass('rowSelected');
                $('#'+rowid).addClass('rowSelected');
                if ($(e.target || e.srcElement).hasClass('ui-icon') || $(e.target || e.srcElement).parent().hasClass('ui-icon')) {
                    return false;
                }
                var tr = $tblGrid.jqGrid("getInd", rowid, true);

                var rowObj = $(tr);
                rowObj.addClass('customRowSelect');

                // if ($tblGrid.find('#chkSendStudy_' + rowid).length > 0) {
                //     $tblGrid.find('#chkSendStudy_' + rowid).attr('checked',true);
                // }

                if (self.options.dblClickActionIndex == -2) {
                    e.stopPropagation();
                }
                else {
                    if (typeof(self.options.dblClickActionIndex) != 'undefined' && typeof(self.options.colModel[self.options.dblClickActionIndex].route) != 'undefined') {
                        Backbone.history.navigate(self.options.colModel[self.options.dblClickActionIndex].route + rowid, true);
                    } else {
                        if (typeof(self.options.ondblClickRow) != 'undefined') {
                            self.options.ondblClickRow(rowid, iRow, iCol, e);
                        }
                    }
                }
                return false;
            },

            onSortCol: function (name, index, iCol) {
                if ( self.options && self.options.colModel[index] && self.options.colModel[index].name == name && self.options.colModel[index].sort == false) {
                    return false;
                }
                self.options.isSearch = true;
                commonjs.scrollLeft = $tblGrid.closest('.ui-jqgrid-bdiv').scrollLeft();
                self.firstTime = true;
                self.pager.set('PageSize', 100);
                self.pager.set('PageNo', 1);
                if (self.pager.get("SortField") == name) {
                    self.pager.set({
                        "SortOrder": self.pager.get("SortOrder") == "ASC" ? "DESC" : "ASC",
                        "SortField": name
                    });
                }
                else {
                    self.pager.set({"SortOrder": "ASC", "SortField": name});
                }

                self.fetchGrid();
                //Added for fire column header sorting event...
                if (typeof(self.options.onSortCol) != 'undefined')
                    self.options.onSortCol(name, index, iCol);
            },

            onPaging: function (arg) {
                self.doPaging(arg);
            },

            rowattr: function ( array, rowdata, rowid ) {
                if ( typeof self.options.rowattr === 'function' ) {
                    return self.options.rowattr(array, rowdata, rowid);
                }
            },

            afterInsertRow: function ( rowid, rowdata ) {

                if ( typeof self.options.afterInsertRow === 'function' ) {
                    self.options.afterInsertRow(rowid, rowdata);
                }

                //Added for Query&Retrieve Paging update when new row gets inserted
                if ( typeof self.options.onaftergridrowbindQR !== 'undefined' && typeof self.options.onaftergridbind === 'function' ){
                    self.options.onaftergridbind(null, self, {pager: self.pager}, self.options.currentObject);
                }
            }
        });

        if (options.disablepaging) {
            $(self.options.pager + '_center').hide();
        }

        if (!options.disablesearch) {
            self.options.grid.jqGrid('filterToolbar', {
                searchOnEnter: true,
                beforeSearch: function () {
                    if (typeof(self.options.beforeSearch) != 'undefined') {
                        self.options.beforeSearch();
                    }
                    self.options.isSearch = true;
                    self.pager.set({"PageNo": 1});
                    self.firstTime = true;
                    self.pager.set('PageSize', 100);
                    self.fetchGrid();
                }
            });
        }

        if (!options.disableadd) {
            var icon = 'icon-ic-plus';
            self.options.grid.jqGrid('navGrid', self.options.pager, {
                del: false,
                add: false,
                edit: false,
                search: false,
                refresh: false
            }).navButtonAdd(this.options.pager, {
                caption: "Add",
                buttonicon: icon,
                onClickButton: function () {
                    //Backbone.history.navigate('facility/new',true);
                    Backbone.history.navigate(self.options.routes.new, true);
                },

                position: "last"
            });

            self.iconsToBeHighlighted.push({icon: icon, className: 'btn btn-danger jq-pg-btns'});
        }

        if (typeof self.options.customButtons != 'undefined') {
            for (var i = 0; i < options.customButtons.length; i++) {
                this.options.grid.jqGrid('navGrid', this.options.pager, {
                    del: false,
                    add: false,
                    edit: false,
                    search: false,
                    refresh: false
                }).navButtonAdd(this.options.pager, {
                    caption: options.customButtons[i].caption,
                    buttonicon: options.customButtons[i].buttonicon,
                    onClickButton: options.customButtons[i].onClickButton,
                    position: options.customButtons[i].position
                });

                this.iconsToBeHighlighted.push({
                    icon: options.customButtons[i].buttonicon,
                    className: options.customButtons[i].className
                });
            }
        }

        if (!options.disablereload) {
            var icon = "ui-icon-arrowrefresh-1-n";

            this.options.grid.jqGrid('navGrid', this.options.pager, {
                del: false,
                add: false,
                edit: false,
                search: false,
                refresh: false
            }).navButtonAdd(this.options.pager, {
                caption: "Reload",
                buttonicon: icon,
                onClickButton: function () {
                    self.pager.set({"PageNo": 1});
                    self.refreshAll();
                },

                position: "last"
            });

            self.iconsToBeHighlighted.push({icon: icon, className: 'btn-refresh jq-pg-btns'});
        }

        var gridID = self.options.gridelementid ? self.options.gridelementid.replace('#', '') : '';
        var $bdiv = $tblGrid.closest('.ui-jqgrid-bdiv');
        $("#gview_" + gridID + " .ui-jqgrid-bdiv").scroll(function (e) {
            var is_valid_event = true;
            // EXA-9228 scroll event firing for previous tab grid before loading current grid , so the paging not working . Avoid based on study filter ID
            if (self.options && self.options.customargs && self.options.customargs.flag == 'home_study') {
                var grid_element_id = $(e.currentTarget).find('table').attr('id');
                grid_element_id =  self.options.isClaimGrid?grid_element_id.split('tblClaimGrid')[1]:grid_element_id.split('tblGrid')[1];
                is_valid_event = grid_element_id == commonjs.currentStudyFilter;
            }
            if (is_valid_event) {
                var recordsCount = self.datastore.length;
                if ((e.currentTarget.scrollHeight) <= (e.currentTarget.scrollTop + e.currentTarget.clientHeight + 500)
                    && parseInt(self.pager.get("TotalRecords")) > 0
                    && recordsCount >= parseInt(self.pager.get("PageSize"))
                    && recordsCount < self.pager.get("TotalRecords")
                    && self.scrollingflag == true) {
                    commonjs.showLoading_v1();
                    self.scrollingflag = false;
                    if (self.firstTime) {
                        var initialSize = 100
                            , page_size_config = parseInt(self.getRowCount())
                            , page_no = (initialSize + page_size_config) / page_size_config;
                        self.pager.set('PageSize', self.getRowCount());
                        self.pager.set('PageNo', page_no);
                        self.firstTime = false;
                    } else {
                        var pageNo = parseInt(self.pager.get('PageNo'));
                        pageNo++;
                        self.pager.set('PageNo', pageNo);
                    }
                    commonjs.scrollLeft = $bdiv.scrollLeft();
                    self.fetchGrid(true);
                }
                e.stopPropagation();
            }
            else {
                self.firstTime = true;
                return;
            }
        });

        if(options.stickysearch){
            var cols = self.pager.get("FilterCol") ? self.pager.get("FilterCol") : [];
            var data = self.pager.get("FilterData") ? self.pager.get("FilterData") : [];
            cols.forEach(function(col, i){
                $('#gs_'+col).val(data[i]);
            });
        }

        self.pager.set({
            "DefaultFilterQuery": "",
            "FilterQuery": "",
            "FilterData": (options.stickysearch && data) || "",
            "FilterCol": (options.stickysearch && cols) || "",
            "SortOrder": (options.stickysort && self.pager.get("SortOrder")) || options.sortorder,
            "SortField": (options.stickysort && self.pager.get("SortField")) || options.sortname
        });

        self.highlightIcons();

        var sync = function ( collection, response, options ) {
            var filterID = options.filterID || self.options.filterid;
            if ( !filterID || filterID === commonjs.currentStudyFilter ) {
                if ( !options.reset ) {
                    var models = collection.models.slice(options.nextIndex);
                    self.bindScroll(models, $tblGrid);
                }
                else {
                    self.bindGrid(collection.models, $tblGrid);
                }
            }
            if ( filterID === commonjs.currentStudyFilter ) {
                commonjs.setFilter(filterID, self);
            }
            commonjs.hideLoading();
        };

        self.datastore.on('sync', sync);
        return self.fetchGrid();
    };

    this.highlightIcons = function () {
        var self = this;
        var $span = $('.ui-pager-control').find('.navtable').find('.ui-pg-div').find('span');
        setTimeout(function () {
            for (var i = 0; i < self.iconsToBeHighlighted.length; i++) {
                $span.filter('.' + self.iconsToBeHighlighted[i].icon).parent().addClass(self.iconsToBeHighlighted[i].className);
            }
        }, 10);
    };

    this.doPaging = function ( arg, callback ) {
        commonjs.scrollLeft = this.customGridTable.closest('.ui-jqgrid-bdiv').scrollLeft();
        var pagerID = this.options.pager ? this.options.pager.replace('#', '') : 'gridPager';
        if (!$('#' + arg).hasClass('ui-state-disabled') || arg == 'user') {
            switch (arg) {
                case "first_" + pagerID:
                    this.pager.set({"PageNo": 1});
                    break;
                case "prev_" + pagerID:
                    this.pager.set({"PageNo": this.pager.get('PrevPage')});
                    break;
                case "next_" + pagerID:
                    this.pager.set({"PageNo": this.pager.get('NextPage')});
                    break;
                case "last_" + pagerID:
                    this.pager.set({"PageNo": this.pager.get('LastPageNo')});
                    break;
                case "user":
                    if (parseInt($.trim(this.customGridTable.closest('.ui-jqgrid').find('.ui-pg-input').val())) > 0) {
                        this.pager.set({"PageNo": $.trim(this.customGridTable.closest('.ui-jqgrid').find('.ui-pg-input').val())});
                    }
                    else {
                        this.customGridTable.closest('.ui-jqgrid').find('.ui-pg-input').val('');
                        this.pager.set({"PageNo": 1});
                    }
                    break;
            }
            //$(this.options.gridelementid).jqGrid('clearGridData');
            this.fetchGrid();
        }
        if ( typeof callback === 'function' ) {
            return callback(this);
        }
    };

    this.fetchGrid = function ( isScroll ) {
        /**
         * TODO:  Split this method into different versions for full load/refresh
         * vs. scroll OR do it all at once with smarter handling in the data table
         */
        var $loading = $(document.getElementById('divPageLoading'));
        var $tblGrid = $(self.options.gridelementid);
        $loading.show();
        commonjs.showLoading()
        self.setSearchQuery();
        if (self.options.gridelementid === "#tblpaymentsGrid") {
            commonjs.paymentFilterFields = [];
        }
        var customArgs = null;
        var params = $tblGrid.jqGrid("getGridParam");
        if ( params && params.customargs ) {
            customArgs = params.customargs;
        }
        else {
            if ( typeof self.options.customargs !== 'undefined' ) {
                self.options.customargs.countFlag = false;
                customArgs = self.options.customargs;
            }
        }
        /*if ( !isScroll || typeof isScroll === 'function' ) {
            self.datastore.reset();
        }*/
        $("#chkStudyHeader_"+self.options.filterid ).prop('checked',false);
        var nextIndex = self.datastore.length;
        var filterData = self.pager.get('FilterData');
        var filterCol = self.pager.get('FilterCol');
        var SearchFlag=self.pager.get('searchFlag');
        // Added fromDate/toDate
        var _fromDate = (self.fromDate && $(self.fromDate).length)? $(self.fromDate).val() : null;
        var _toDate = (self.toDate && $(self.toDate).length)? $(self.toDate).val() : null;


        var _data = {
            "pageNo": self.pager.get('PageNo'),
            "pageSize": self.pager.get('PageSize'),
            "filterData": JSON.stringify(filterData),
            "filterCol": JSON.stringify(filterCol),
            "sortField": self.pager.get('SortField'),
            "sortOrder": self.pager.get('SortOrder'),
            "customArgs": customArgs ? Object.assign({}, customArgs, {
                "statOverride": !!(app.usersettings && app.usersettings.worklist_filter_info && app.usersettings.worklist_filter_info.options && app.usersettings.worklist_filter_info.options.statOverride)
            }) : customArgs,
            "SearchFlag":SearchFlag
        };

        // Added fromDate/toDate
        if (_fromDate && _fromDate.length) {
            _data.fromDate = _fromDate;
            if (_toDate && _toDate.length) {
                _data.toDate = _toDate;
            }
        }
        var filterID = self.options.filterid;
        self.datastore.fetch({
            'data': _data,
            'timeout': commonjs.requestTimeout,
            'processData': true,
            'ignoreAdd': true,
            'validate': false,
            'remove': false,
            'nextIndex': nextIndex,
            'reset': !isScroll || typeof isScroll === 'function',
            'filter': self,
            'filterID': filterID,
            'success': function ( collection, response ) {
                if ( collection.models && collection.models.length > 0 && collection.models[0].attributes && collection.models[0].attributes.response == 'Not' ) {
                    commonjs.hideLoading();
                    return false;
                }
                if ( commonjs.isValidResponse(response) ) {
                    // console.log('datastore.fetch, url: %s, data: %O', self.datastore.url ? self.datastore.url: "---", _data);
                    // console.log('datastore.fetch, response: %O', response);
                    //app.workListStudiesData = response.result;

                    if ( typeof isScroll === 'function' ) {
                        isScroll(self);
                    }
                }
                self.scrollingflag = true;
            },
            'error': function (model, err) {
                commonjs.handleXhrError(model, err);
            }
        });
    };

    // sets pagers' FilterData, FilterCol, FilterQuery
    //  pager's FilterQuery is not being sent on datastore.fetch() so commenting that part out untill it can be removed

    var _BEFORE_SPLIT = '(?:';
    var _MIDDLE_SPLIT = ').*(?:';
    var _AFTER_SPLIT = ').*';
    var regNonAlphaNum = /[^A-Za-z0-9]+/g;
    var regSpace = /\s/g;
    var regSplit = /,\s?/;
    var regUndesirables = /[^A-Z0-9\s\-,]/g;
    var regDelivery = /delivery\\?_/g;

    var makeRegEx = function ( value ) {
        var splitArr = String(value).replace(regNonAlphaNum, ' ').split(regSpace);
        var joinedStr = splitArr.join(_MIDDLE_SPLIT);
        return new RegExp(_BEFORE_SPLIT + joinedStr + _AFTER_SPLIT, 'i');
    };

    var getDates = commonjs.getDates.bind(null);

    // Separate function to use in maps as well
    var Data = function ( name, data ) {
        switch ( name ) {
            case 'facility_name':
                this.type = 'id';
                this.data = data;
                break;
            case 'study_dt':
            case 'scheduled_dt':
            case 'study_received_dt':
            case 'birth_date':
            case 'status_last_changed_dt':
            case 'mu_last_updated':
            case 'approved_dt':
            case 'created_date':
            case 'check_indate':
                this.type = 'date';
                this.data = data;
                break;
            case 'mudatacaptured':
            case 'has_deleted':
            case 'eligibility_verified':
                this.type = 'boolean';
                this.data = data.toLowerCase() === 'true';
                break;
            case 'image_delivery':
                this.type = 'array';
                this.data = data.replace(regDelivery, '').split(regSplit);
                break;
            case 'order_status':
            case 'study_status':
            case 'dicom_status':
                this.type = 'status';
                this.data = data.toUpperCase().replace(regUndesirables, '').split(regSplit);
                break;
            default:
                this.type = 'text';
                this.data = makeRegEx(data);
                break;
        }
    };

    var getPaymentHeaderValues = function (elementID) {
        var paymentFilterValues='';
        if (commonjs.paymentFilterFields) {
            paymentFilterValues =  $.grep(commonjs.paymentFilterFields, function (obj) {
                    return obj && (obj.split('~')[0] == elementID)
            });
            return paymentFilterValues[0].split('~')[1];
        }else return '';

    };

    this.setSearchQuery = function () {
        var filterData = [];
        var filterRegData = [];
        var filterCol = [];
        var searchFlagArr=[];
        var $toolBar = $('#gview_' + self.options.gridelementid.replace('#', '')).find('.ui-search-toolbar');

        var elements = $toolBar.find('.ui-th-column')
            .filter(function() {
                var element = $(this);

                // must check display === none, not :visible pseudo selector, else you will get false positives
                // since we are switching between tabs where the tab data is not visible at time of setting search query
                if(element.css('display') === 'none') {
                    element.remove();
                    return false;
                }

                return true;
            })
            .find('select, input');

        $.each(elements, function (index, element) {
            if(self.options.gridelementid === "#tblpaymentsGrid") {
                if(self.options.customargs.from === 'ris') {
                    $('#gs_payer_type').val('patient');
                    $("#gs_payer_type").attr('disabled', true);
                }
            }

            if (element && element.id == 'gs_assigned_to' && !$(element).val() && self.options.isClaimGrid) {
                $("#gs_assigned_to").val(app.userID);
                if (app.userInfo && app.userInfo.user_settings && (app.userInfo.user_settings.assignClaimsToFollowUpQueue == "true" || app.userInfo.user_type == 'SU')) {
                    $("#gs_assigned_to").removeAttr('disabled');

                }
                else $("#gs_assigned_to").attr('disabled', 'disabled');
            }

            if (commonjs.paymentFilterFields && commonjs.paymentFilterFields.length && self.options.gridelementid === "#tblpaymentsGrid") {
                var paymentValue = getPaymentHeaderValues(element.id);
                if (paymentValue) {
                    $("#" + element.id).val(paymentValue);
                }
            }

            if (element && element.id == 'gs_billing_method' && $(element).val() == '' && self.options.isClaimGrid) {
                $("#btnPaperClaim").hide();
                if (self.options.filterid != "Follow_up_queue")
                    $("#btnInsuranceClaim").show();
            }
            if (commonjs.checkNotEmpty($(element).val())) {

                try {
                    new RegExp(element.value);  // explodes if the search value isn't a valid regular expression
                }
                catch(e) {
                    commonjs.showWarning('messages.warning.setup.invalidSearchCriteria');
                    return;
                }

                var searchFlag = '';
                var defaultValue = '';
                var searchColumns = [];
                var searchCondition = ' AND ';
                var searchoptionsalt = null;
                var validateMoney = null;
                var paymentIDFormatter = null;
                for (var i = 0; i < self.options.colModel.length; i++) {
                    if (!self.options.colModel[i].hidden && element.name == self.options.colModel[i].name) {
                        searchFlag = self.options.colModel[i].searchFlag;

                        if (typeof(self.options.colModel[i].defaultValue) != 'undefined')
                            defaultValue = self.options.colModel[i].defaultValue;

                        if (typeof(self.options.colModel[i].searchColumns) != 'undefined')
                            searchColumns = self.options.colModel[i].searchColumns;

                        if (typeof(self.options.colModel[i].searchCondition) != 'undefined')
                            searchCondition = ' ' + self.options.colModel[i].searchCondition + ' ';

                        if (typeof(self.options.colModel[i].searchoptionsalt) != 'undefined')
                            searchoptionsalt = self.options.colModel[i].searchoptionsalt;

                        if (typeof (self.options.colModel[i].validateMoney) != 'undefined')
                            validateMoney = self.options.colModel[i].validateMoney;

                        if (typeof (self.options.colModel[i].paymentIDFormatter) != 'undefined')
                            paymentIDFormatter = self.options.colModel[i].paymentIDFormatter;

                        break;
                    }
                }

                var filterValue = self.getFilterValue(element.name, defaultValue, searchoptionsalt, validateMoney, paymentIDFormatter);

                if ( /mu_last_updated|check_indate|(.*_(dt|date)$)/.test(element.name) ) {
                    var dates = getDates(filterValue);
                    filterData.push(dates);
                    filterRegData.push(new Data(element.name, dates));
                }
                else {
                    filterData.push(filterValue);
                    filterRegData.push(new Data(element.name, filterValue));
                }

                searchFlagArr.push(searchFlag);
                filterCol.push(element.name);
            }
        });

        var filterDataValue = filterData;

        if (self.options.isClaimGrid) {
            if (this.options.filterid == 'Follow_up_queue') {
                $("#btnInsuranceClaim").hide();
            } else if (filterCol.indexOf('billing_method') > -1 && filterDataValue.indexOf('paper\\_claim') > -1) {
                $("#liEC").addClass('disabled');
                $("#liPCBW").removeClass('disabled');
                $("#liPCRED").removeClass('disabled');
                $("#liINSD").addClass('disabled');
                $("#liINPN").addClass('disabled');
                $("#liPP").addClass('disabled');
                $("#btnClaimFormat").attr('data-method', 'paper_claim');

                if (localStorage.getItem('default_paperclaim')) {
                    $("#btnClaimFormat").text(localStorage.getItem('default_paperclaim'));
                    $("#btnClaimFormat").attr('data-format', localStorage.getItem('default_paperclaim_format'));
                    $("#btnClaimFormat").attr('data-value', localStorage.getItem('default_paperclaim'));

                } else {
                    $("#btnClaimFormat").text($("#liPCBW").find('a').attr('data-value'));
                    $("#btnClaimFormat").attr('data-format', $("#liPCBW").find('a').attr('data-format'));
                    $("#btnClaimFormat").attr('data-value', $("#liPCBW").find('a').attr('data-value'));
                }


            }
            else if (filterCol.indexOf('billing_method') > -1 && filterDataValue.indexOf('electronic\\_billing') > -1) {
                $("#liEC").removeClass('disabled');
                $("#liPCBW").addClass('disabled');
                $("#liPCRED").addClass('disabled');
                $("#liINSD").addClass('disabled');
                $("#liINPN").addClass('disabled');
                $("#liPP").addClass('disabled');
                $("#btnClaimFormat").attr('data-method', 'electronic_billing');
                $("#btnClaimFormat").text($("#liEC").find('a').attr('data-value'));
                $("#btnClaimFormat").attr('data-value', $("#liEC").find('a').attr('data-value'));

            }
            else if (filterCol.indexOf('billing_method') > -1 && filterDataValue.indexOf('direct\\_billing') > -1) {
                $("#liEC").addClass('disabled');
                $("#liPCBW").addClass('disabled');
                $("#liPCRED").addClass('disabled');
                $("#liINSD").removeClass('disabled');
                $("#liINPN").removeClass('disabled');
                $("#liPP").addClass('disabled');
                $("#btnClaimFormat").attr('data-method', 'direct_billing');

                if (localStorage.getItem('default_directbilling')) {

                    $("#btnClaimFormat").text(localStorage.getItem('default_directbilling'));
                    $("#btnClaimFormat").attr('data-value', localStorage.getItem('default_directbilling'));
                    $("#btnClaimFormat").attr('data-format', (localStorage.getItem('default_directbilling_format')));

                }
                else {

                    $("#btnClaimFormat").text($("#liINSD").find('a').attr('data-value'));
                    $("#btnClaimFormat").attr('data-value', $("#liINSD").find('a').attr('data-value'));
                    $("#btnClaimFormat").attr('data-format', $("#liINSD").find('a').attr('data-format'));
                }

            }
            else if (filterCol.indexOf('billing_method') > -1 && filterDataValue.indexOf('patient\\_payment') > -1) {
                $("#liEC").addClass('disabled');
                $("#liPCBW").addClass('disabled');
                $("#liPCRED").addClass('disabled');
                $("#liINSD").addClass('disabled');
                $("#liINPN").addClass('disabled');
                $("#liPP").removeClass('disabled');
                $("#btnClaimFormat").attr('data-method', 'patient_payment');
                $("#btnClaimFormat").text($("#liPP").find('a').attr('data-value'));

            } else {
                $("#liEC").removeClass('disabled');
                $("#liPCBW").removeClass('disabled');
                $("#liPCRED").removeClass('disabled');
                $("#liINSD").removeClass('disabled');
                $("#liINPN").removeClass('disabled');
                $("#liPP").removeClass('disabled');
            }
        }
        self.pager.set({
            "DefaultFilterQuery": "",
            "FilterQuery": "",
            "FilterData": filterData,
            "FilterRegData": filterRegData,
            "FilterCol": filterCol,
            "searchFlag": searchFlagArr
        });
    };

    var getIDKey = function ( row ) {
        return row.idAttribute ||
            row.id && 'id' ||
            row.study_id && 'study_id' ||
            row.order_id && 'order_id' ||
            row.filter_id && 'filter_id';
    };

    this.bindScroll = function ( dataset, $tblGrid ) {
        $tblGrid = $tblGrid || self.customGridTable || $(self.options.gridelementid);

        if ( dataset.length === 0 ) {
            self.pager.set({
                "TotalRecords": 0
            });
        }
        else if ( dataset[ 0 ].get('total_records') ) {
            self.pager.set({
                "TotalRecords": dataset[ 0 ].get('total_records')
            });
        }

        var reader = {
            rowNum: 5,
            repeatitems: false,
            page: function ( obj ) {
                return self.pager.get('PageNo');
            },
            total: function ( obj ) {
                return Math.ceil(self.pager.get('TotalRecords') / self.pager.get('PageSize'));
            },
            records: function ( obj ) {
                return self.pager.get('TotalRecords');
            }
        };

        $tblGrid.setGridParam({
            localReader: reader,
            jsonReader: reader
        });

        if ( dataset.length < 1 ) {
            $tblGrid.append('<tr id="tr-no-records"><td colspan="100" style="text-align: center;font-size:14px;"> No Records Found</td></tr>');

            var gridTop = ($tblGrid.closest('.ui-jqgrid-bdiv').height() / 2);
            var pagerID = self.options.pager ?
                          self.options.pager.replace('#', '') :
                          'gridPager';
            $tblGrid.parent().css('top', gridTop + "px");

            $("#next_" + pagerID).addClass('ui-state-disabled');
            $("#last_" + pagerID).addClass('ui-state-disabled');
        }
        else {
            if ( typeof self.options.onbeforegridbind !== 'undefined' ) {
                self.options.onbeforegridbind(dataset, self.options.currentObject, self.pager);
            }

            var rows = [];
            var i = 0;
            var data;
            for ( ; i < dataset.length; ++i ) {
                data = dataset[ i ];
                if ( typeof self.options.onbeforerowbind !== 'undefined' ) {
                    self.options.onbeforerowbind(data, self);
                }

                rows.push(data.toJSON());

                if ( typeof self.options.onrowbound !== 'undefined' ) {
                    self.options.onrowbound(data, self);
                }
            }

            var idKey = getIDKey(dataset[ 0 ]);

            $tblGrid.jqGrid('addRowData', idKey, rows);

            $tblGrid.parent().css('top', 'auto');
        }

        var pageSize = parseInt(self.pager.get('PageSize'));

        var startIndex = ((self.pager.get('PageNo') - 1) * pageSize) + 1;
        var endIndex = ((startIndex + pageSize - 1) > self.pager.get('TotalRecords')) ?
                       self.pager.get('TotalRecords') :
                       (startIndex + pageSize - 1);

        if(endIndex == self.pager.get('TotalRecords'))
            self.scrollingflag = false;

        $tblGrid
            .closest('.ui-jqgrid')
            .find('.ui-paging-info')
            .html("Showing " + endIndex + " of " + self.pager.get('TotalRecords'));

        var pgTables = $tblGrid.closest('.ui-jqgrid').find('.ui-jqgrid-pager').find('.ui-pg-table');
        var pagingFooter = pgTables.eq(1).find('td');
        if ( pagingFooter.length > 0 ) {
            pagingFooter.eq(0).removeClass('ui-state-disabled');
            pagingFooter.eq(1).removeClass('ui-state-disabled');
            pagingFooter.eq(5).removeClass('ui-state-disabled');
            pagingFooter.eq(6).removeClass('ui-state-disabled');
            pagingFooter.eq(3).html("&nbsp;Showing " + endIndex + " of " + self.pager.get('TotalRecords'));
        }

        if ( typeof self.options.onaftergridbind === 'function' ) {
            self.options.onaftergridbind(dataset, self, { pager: self.pager }, self.options.currentObject);
        }

        $tblGrid.closest('.ui-jqgrid-bdiv').scrollLeft(commonjs.scrollLeft);
        $("span").tooltip({
            'selector': '',
            'placement': 'right'
        });

        $('.ui-jqgrid-hdiv').on('scroll', function ( e ) {
            $('.ui-jqgrid-bdiv').scrollLeft($(this).scrollLeft())
        });

    };

    this.bindGrid = function ( dataset, $tblGrid ) {
        $tblGrid = $tblGrid || self.customGridTable || $(self.options.gridelementid);

        if ( dataset.length === 0 ) {
            self.pager.set({
                "TotalRecords": 0
            });
        }
        else if ( dataset[0].get('total_records') ) {
            self.pager.set({
                "TotalRecords": dataset[0].get('total_records')
            });
        }
        self.pager.set('PageNo', 1);
        self.setPagerInfos();

        var reader = {
            rowNum: 5,
            repeatitems: false,
            page: function (obj) {
                return self.pager.get('PageNo');
            },
            total: function (obj) {
                return Math.ceil(self.pager.get('TotalRecords') / self.pager.get('PageSize'));
            },
            records: function (obj) {
                return self.pager.get('TotalRecords');
            }
        };
        $tblGrid.setGridParam({
            "records": 0
        });
        $tblGrid.setGridParam({
            localReader: reader,
            jsonReader: reader
        }).trigger('reloadGrid', [{
            current: true
        }]);

        commonjs.scrollLeft = $tblGrid.closest('.ui-jqgrid-bdiv').scrollLeft();
        $tblGrid.find("tr").slice(1).remove();

        if ( typeof self.options.onbeforegridbind !== 'undefined' ) {
            self.options.onbeforegridbind(dataset, self.options.currentObject, self.pager);
        }

        var emptyGridOverlay = $('.emptyGridOverlay', $('.Grid:visible'));

        if ( dataset.length < 1 ) {
            // SMH - Changed to display an empty message in the center of the viewport rather than the grid

            emptyGridOverlay.show();
            var top = ~~((top - emptyGridOverlay.outerHeight()) / 2),
                left = ~~(emptyGridOverlay.outerWidth() / 2);

            emptyGridOverlay.css({
                'top': 'calc(50% - ' + top + 'px)',
                'left': 'calc(50% - ' + left + 'px)'
            });

            // SMH - Added to retain grid scrolling ability
            $tblGrid.append('<tr id="tr-no-records"><td colspan="100" style="text-align: center;font-size:14px;">No Records Found</td></tr>');

        }
        else {

            if ( emptyGridOverlay.length ) {
                emptyGridOverlay.remove();
            }

            var rows = [];
            var i = 0;
            var data;
            for ( ; i < dataset.length; ++i ) {
                data = dataset[ i ];
                if ( typeof self.options.onbeforerowbind === 'function' ) {
                    self.options.onbeforerowbind(data, self);
                }

                rows.push(data.toJSON());

                if ( typeof self.options.onrowbound === 'function' ) {
                    self.options.onrowbound(data, self);
                }
            }

            var idKey = getIDKey(dataset[ 0 ]);

            $tblGrid.jqGrid('addRowData', idKey, rows);

            $tblGrid.parent().css('top', 'auto');
        }
        var total = parseInt(self.pager.get('TotalRecords'), 10);
        var pageSize = parseInt(self.pager.get('PageSize'), 10);

        var startIndex = ((self.pager.get('PageNo') - 1) * pageSize) + 1;
        var endIndex = ((startIndex + pageSize - 1) > total) ?
                       total :
                       (startIndex + pageSize - 1);

        $tblGrid
            .closest('.ui-jqgrid')
            .find('.ui-paging-info')
            .html("Showing " + endIndex + " of " + total);

        var pgTables = $tblGrid.closest('.ui-jqgrid').find('.ui-jqgrid-pager').find('.ui-pg-table');
        var pagingFooter = $(pgTables[ 1 ]).find('td');
        if ( pagingFooter.length > 0 ) {
            pagingFooter.eq(0).removeClass('ui-state-disabled');
            pagingFooter.eq(1).removeClass('ui-state-disabled');
            pagingFooter.eq(5).removeClass('ui-state-disabled');
            pagingFooter.eq(6).removeClass('ui-state-disabled');

            pagingFooter.eq(3).html('&nbsp;Page ' + self.pager.get('PageNo') + ' of ' + reader.total() + '&nbsp;');
            pagingFooter.eq(3).html("&nbsp;Showing " + endIndex + " of " + total);

            if ( reader.total() > 0 ) {
                if ( self.pager.get('PageNo') == 1 ) {
                    pagingFooter.eq(0).addClass('ui-state-disabled');
                    pagingFooter.eq(1).addClass('ui-state-disabled');
                }
                if ( self.pager.get('PageNo') == reader.total() ) {
                    pagingFooter.eq(5).addClass('ui-state-disabled');
                    pagingFooter.eq(6).addClass('ui-state-disabled');
                }
            }
            else {
                pagingFooter.eq(0).addClass('ui-state-disabled');
                pagingFooter.eq(1).addClass('ui-state-disabled');
                pagingFooter.eq(5).addClass('ui-state-disabled');
                pagingFooter.eq(6).addClass('ui-state-disabled');
            }
        }

        if ( typeof self.options.onaftergridbind === 'function' ) {
            self.options.onaftergridbind(dataset, self, { pager: self.pager }, self.options.currentObject);
        }

        if ( self.options.delayedPagerUpdate ) {
            if ( self.options.pagerApiUrl && self.options.pagerApiUrl !== '' ) {
                self.updateDelayedPager(self, self.options.pagerApiUrl);
            }
        }
        // $tblGrid.closest('.ui-jqgrid-bdiv').scrollLeft(commonjs.scrollLeft);
        $("span").tooltip({
            'selector': '',
            'placement': 'right'
        });

        $('.ui-jqgrid-hdiv').on('scroll', function ( e ) {
            $('.ui-jqgrid-bdiv').scrollLeft($(this).scrollLeft())
        });

    };

    this.updateDelayedPager = function (filterObj, pagerApi) {
        var customArgs = filterObj.options.customargs;
        customArgs.countFlag = true;
        filterObj.customGridTable.closest('.ui-jqgrid').find('.ui-paging-info').html('Showing <i class="fa fa-spinner loading-spinner"></i> of <i class="fa fa-spinner loading-spinner"></i>')
        jQuery.ajax({
            url: pagerApi,
            type: "GET",
            data: {
                filterData: JSON.stringify(filterObj.pager.get('FilterData')),
                filterCol: JSON.stringify(filterObj.pager.get('FilterCol')),
                customArgs: customArgs,
                SearchFlag:filterObj.pager.get('searchFlag')
            },
            success: function (data, textStatus, jqXHR) {
                if (data && data.length) {
                    filterObj.pager.set({ "TotalRecords": data[0].total_records });
                    filterObj.setPagerInfos();

                    filterObj.pager.set({"LastPageNo": Math.ceil(filterObj.pager.get('TotalRecords') / filterObj.pager.get('PageSize'))});

                    if (parseInt(filterObj.pager.get('PageNo')) == 1) {
                        filterObj.pager.set({"PrevPage": 1});
                    }
                    else {
                        filterObj.pager.set({"PrevPage": (parseInt(filterObj.pager.get('PageNo'))) - 1});
                    }

                    if (parseInt(filterObj.pager.get('PageNo')) >= filterObj.pager.get('LastPageNo')) {
                        filterObj.pager.set({"NextPage": filterObj.pager.get('LastPageNo')});
                    }
                    else {
                        filterObj.pager.set({"NextPage": (parseInt(filterObj.pager.get('PageNo'))) + 1});
                    }

                    var pageSize = parseInt(filterObj.pager.get('PageSize'));

                    var startIndex = ((filterObj.pager.get('PageNo') - 1) * pageSize) + 1;
                    var endIndex = ((startIndex + pageSize - 1) > filterObj.pager.get('TotalRecords')) ? filterObj.pager.get('TotalRecords') : (startIndex + pageSize - 1);

                    filterObj.customGridTable.closest('.ui-jqgrid').find('.ui-paging-info').html("Showing " + endIndex + " of " + filterObj.pager.get('TotalRecords'));
                }
            },
            error: function (err) {
                commonjs.handleXhrError(err);
            }
        });
    };

    this.setPagerInfos = function () {
        this.pager.set({"LastPageNo": Math.ceil(this.pager.get('TotalRecords') / this.pager.get('PageSize'))});

        if (parseInt(this.pager.get('PageNo')) == 1) {
            this.pager.set({"PrevPage": 1});
        }
        else {
            this.pager.set({"PrevPage": (parseInt(this.pager.get('PageNo'))) - 1});
        }

        if (parseInt(this.pager.get('PageNo')) >= this.pager.get('LastPageNo')) {
            this.pager.set({"NextPage": this.pager.get('LastPageNo')});
        }
        else {
            this.pager.set({"NextPage": (parseInt(this.pager.get('PageNo'))) + 1});
        }
    };

    this.refresh = function (ishome, callback) {
        if (ishome) {
            this.firstTime = true;
            this.pager.set("PageSize", 100);
            this.fetchGrid(callback);
        } else {
            this.pager.set("PageSize", 100);
            this.pager.set('PageNo', 1);
            this.fetchGrid(callback);
        }
    };

    this.refreshAll = function () {
        //   this.pager.set("PageSize", this.getRowCount());
        this.firstTime = true;
        var $tblGrid = $(this.options.gridelementid);
        this.pager.set("PageSize", 100);
        if (this.pager.get('PageNo') != 1 && $('.jqgrow').length == 1) {
            this.pager.set({"PageNo": this.pager.get('PageNo') - 1});
        }
        this.pager.set({"FilterQuery": ""});
        this.pager.set({"FilterData": ""});
        this.pager.set({"FilterRegData": ""});
        this.pager.set({"FilterCol": ""});
        this.pager.set({"SortField": this.options.sortname});
        this.pager.set({"SortOrder": this.options.sortorder});
        if ( !this.options.disablesearch && $tblGrid.length > 0 ){
            $tblGrid[0].clearToolbar();
        }

        $tblGrid.setGridParam({
            sortname: this.options.sortname,
            sortorder: this.options.sortorder
        });//.trigger("reloadGrid");
        //$(this.options.gridelementid).jqGrid('clearGridData');
        this.fetchGrid();
    };

    this.getFilterValue = function (uiFieldID, defaultValue, searchoptionsalt, validateMoney, paymentIDFormatter) {
        var fieldValue = $.trim($('#gview_' + this.options.gridelementid.replace('#', '') + ' #gs_' + uiFieldID).val());
        if (searchoptionsalt) {
            searchoptionsalt = searchoptionsalt.value;
            fieldValue = searchoptionsalt[fieldValue];
        }

        if (validateMoney) {
            var regExpr = /[0-9]+(\.[0-9]+)?/;
            if (!regExpr.test(fieldValue))
                return '';
        }

        if (typeof fieldValue == 'undefined' || fieldValue == "" || fieldValue == "Select") {
            return '';
        }

        if (paymentIDFormatter) {
            fieldValue = fieldValue && fieldValue.replace(/[^0-9,]/g, '') || '';
        }

        return fieldValue.replace(/'/g, "''").replace(/_/g, '\\_');
    };

    this.getRowCount = function () {
        return (typeof app.currentrowsToDisplay == 'undefined' || !app.currentrowsToDisplay ) ? 25 : app.currentrowsToDisplay;
    };

}
