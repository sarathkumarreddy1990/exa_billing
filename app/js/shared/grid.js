define('grid', [
    'jquery',
    'underscore',
    'change-grid',
    'shared/utils',
    'models/pager',
    'collections/study-fields',
    'collections/studies',
    'collections/claim-workbench',
    'views/claims/index',
    'views/user-settings',
    'views/setup/study-filter',
    'text!templates/setup/study-filter-grid.html',
    'views/claims/claim-inquiry'
], function (jQuery, _, initChangeGrid, utils, Pager, StudyFields, Studies, claimWorkbench, claimsView, UserSettingsView, StudyFilterView, studyFilterGrid, claimInquiryView) {
    var $ = jQuery;
    var isTrue = utils.isTrue;
    var isFalse = utils.isFalse;
    var isNotTrue = utils.isNotTrue;
    var getData = utils.getData;
    var disableRightClick = utils.disableRightClick;
    var setRightMenuPosition = utils.setRightMenuPosition;
    var updateCollection = utils.updateCollection;
    var updateReorderColumn = utils.updateReorderColumn;
    var updateResizeColumn = utils.updateResizeColumn;
    var setScrollHandler = utils.setScrollHandler;
    return function (options) {
        var self = this;
        var filterID = options.filterid;
        var gridID = options.gridelementid;
        var isAdmin = options.isAdmin;
        var $tblGrid = $(gridID);
        var dateFormatter = function (cellvalue, options, rowObject) {
            return '';
        };
        var checkLicense = '';
        var userSettings = options.isClaimGrid ? app.claim_user_settings : app.study_user_settings;
        var risOrderChoose = false;
        var risOrderID = 0;
        var risOrderDetails = [];


        var handleStudyDblClick = function (data, event, gridID) {
            event.stopPropagation();
            if (data === null) {
                return false;
            }
            if (isTrue(data.has_deleted)) {
                return commonjs.showWarning('Study is deleted - nowhere to go unless restored.', '', true);
            }
            var id = data.study_id;
            editStudyID = id;
            return chooseScreen(id, data, event, gridID);
        };

        var openCreateClaim = function (rowID, event, isClaimGrid, store) {
            var target = event.currentTarget;
            var $target = $(target);
            let studyArray = [];
            let selectedStudies = [];
            let divObj = 'studyRightMenu';
            let $divObj = $(document.getElementById(divObj));
            $divObj.empty();
            let gridData = getData(rowID, store, gridID);
            if (gridData === null) {
                return false;
            }
            let $checkedInputs = $tblGrid.find('input').filter('[name=chkStudy]:checked');
            let selectedCount = $checkedInputs.length;
            let _storeEle;
            for (var r = 0; r < selectedCount; r++) {
                var rowId = $checkedInputs[r].parentNode.parentNode.id;
                _storeEle = getData(rowId, store, gridID);
                studyArray.push(rowId);
                var study = {
                    study_id: rowId,
                    patient_id: _storeEle.patient_id,
                    facility_id: _storeEle.facility_id,
                    study_date: _storeEle.study_dt,
                    patient_name: _storeEle.patient_name,
                    account_no: _storeEle.account_no,
                    patient_dob: _storeEle.birth_date,
                    accession_no: _storeEle.accession_no,
                };
                selectedStudies.push(study);
            }
            var studyIds = studyArray.join();
            if (isClaimGrid) {
                var liClaimStatus = commonjs.getRightClickMenu('ul_change_claim_status','setup.rightClickMenu.billingStatus',false,'Change Claim Status',true); 
                $divObj.append(liClaimStatus);
                var liArray = [];
                $.each(app.claim_status, function (index, claimStatus) {                      
                    var $claimStatusLink = $(commonjs.getRightClickMenu('ancclaimStatus_' + claimStatus.id,'setup.rightClickMenu.billingCode',true,claimStatus.description ,false));                        
                        $claimStatusLink.click(function () {

                            $.ajax({
                                url: '/exa_modules/billing/claimWorkbench/update',
                                type: 'PUT',
                                data: {
                                    claimIds: studyIds,
                                    claim_status_id:claimStatus.id
                                },
                                success: function (data, response) {
                                    commonjs.showStatus('Claim Status has been changed');
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArray[liArray.length] = $claimStatusLink;
                });
                $('#ul_change_claim_status').append(liArray);

                var liBillingCode = commonjs.getRightClickMenu('ul_change_billing_code','setup.rightClickMenu.billingCode',false,'Change Billing Code',true);       
                $divObj.append(liBillingCode);
                var liArrayBillingCode = [];

                $.each(app.billing_codes, function (index, billing_code) {                   
                        var $billingCodeLink = $(commonjs.getRightClickMenu('ancBillingCode_' + billing_code.id,'setup.rightClickMenu.billingCode',true,billing_code.description ,false));
                       
                        $billingCodeLink.click(function () {
                            $.ajax({
                                url: '/exa_modules/billing/claimWorkbench/update',
                                type: 'PUT',
                                data: {
                                    claimIds: studyIds,
                                    billing_code_id:billing_code.id
                                },
                                success: function (data, response) {
                                    commonjs.showStatus('Billing Code has been changed');
                                },
                                error: function (err, response) {
                                    commonjs.handleXhrError(err, response);
                                }
                            });
                        });
                        liArrayBillingCode[liArrayBillingCode.length] = $billingCodeLink;
                });
                $('#ul_change_billing_code').append(liArrayBillingCode);


                var liBillingClass = commonjs.getRightClickMenu('ul_change_billing_class','setup.rightClickMenu.billingClass',false,'Change Billing Class',true);                 
                $divObj.append(liBillingClass);
                var liArrayBillingClass = [];
                $.each(app.billing_classes, function (index, billing_class) {       
                    var $BillingClassLink = $(commonjs.getRightClickMenu('ancBillingClass_' + billing_class.id,'setup.rightClickMenu.billingClass',true,billing_class.description ,false));                                   
                        
                        $BillingClassLink.click(function () {
                                $.ajax({
                                    url: '/exa_modules/billing/claimWorkbench/update',
                                    type: 'PUT',
                                    data: {
                                        claimIds: studyIds,
                                        billing_class_id:billing_class.id
                                    },
                                    success: function (data, response) {
                                        commonjs.showStatus('Billing Classes has been changed');
                                    },
                                    error: function (err, response) {
                                        commonjs.handleXhrError(err, response);
                                    }
                                });
                            });
                       
                        liArrayBillingClass[liArrayBillingClass.length] = $BillingClassLink;
                });
                $('#ul_change_billing_class').append(liArrayBillingClass);
               
                var liPayerType =  commonjs.getRightClickMenu('ul_change_payer_type','setup.rightClickMenu.billingPayerType',false,'Change Billing PayerType',true);                 
                $divObj.append(liPayerType);                        
                $('#ul_change_payer_type').append("under consturction");

                var liEditClaim = commonjs.getRightClickMenu('anc_edit_claim','setup.rightClickMenu.editClaim',false,'Edit Claim',false);         
                
                if(studyArray.length == 1)
                    $divObj.append(liEditClaim);

                $('#anc_edit_claim').off().click(function () {

                    self.claimView = new claimsView();
                    self.claimView.showEditClaimForm(studyIds);
                });
                         
                var liClaimInquiry = commonjs.getRightClickMenu('anc_claim_inquiry','setup.rightClickMenu.claimInquiry',false,'Claim Inquiry',false);
                if(studyArray.length == 1)
                    $divObj.append(liClaimInquiry);
                $('#anc_claim_inquiry').click(function () {
                     commonjs.showDialog({
                    'header': 'Claim Inquiry',
                    'width': '95%',
                    'height': '85%',
                    'needShrink': true
                });
                self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                self.claimInquiryView.render(studyIds);
                });
                
                var liSplitOrders = commonjs.getRightClickMenu('anc_split_orders','setup.rightClickMenu.splitOrders',false,'Split Orders',false);
                $divObj.append(liSplitOrders);
                $('#anc_split_orders').click(function () {
                    alert("under Constraction");
                });

            } else {                
                var liCreateClaim = commonjs.getRightClickMenu('anc_create_claim','setup.rightClickMenu.createClaim',false,'Create Claim',false);
                if(studyArray.length == 1)
                    $divObj.append(liCreateClaim);
                $('#anc_create_claim').off().click(function () {
                    window.localStorage.setItem('selected_studies', null);
                    window.localStorage.setItem('first_study_details', null);
                    window.localStorage.setItem('primary_study_details', JSON.stringify(selectedStudies[0]));
                    window.localStorage.setItem('selected_studies', JSON.stringify(studyIds));
                    self.claimView = new claimsView();
                    self.claimView.showClaimForm(studyIds);
                });
            }

            $divObj.show();
            setRightMenuPosition(divObj, event);
            event.preventDefault();
        };

        self.renderStudy = function () {
            if (options.isClaimGrid)
                var studyStore = new claimWorkbench(null, { 'filterID': filterID });
            else {
                var studyStore = new Studies(null, { 'filterID': filterID });
            }
            var claimsTable = new customGrid(studyStore, gridID);
            var changeGrid = initChangeGrid(claimsTable);
            var transcriptionHide = true;
            var opalViewerHide = true;
            var dicomViewerHide = true;
            var showPriorsHide = true;
            var reportHide = true;
            var colName = [];
            var i18nName = [];
            var colModel = [];

            if (!options.isPrior && !showPriorsHide && isNotTrue(options.showEncOnly)) {
                colName.push('');
                i18nName.push('');
                colModel.push({
                    name: 'as_prior',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: false,
                    isIconCol: true, // SMH Bug #2606 - Mark column as an icon cell which can be hidden
                    formatter: function (cellvalue, options, rowObject) {
                        return !rowObject.has_priors ?
                            "<i class='icon-ic-prior-studies' style='opacity: 0.3' title='Prior'></span>" :
                            "<i class='icon-ic-prior-studies' title='Prior'></span>";
                    },
                    customAction: function (rowID, e, that) {
                        var gridData = getData(rowID, studyStore, gridID);
                        if (gridData === null) {
                            return false;
                        }
                        if (isTrue(gridData.has_priors)) {
                            options.setpriorstudies(rowID, filterID, gridData);
                            return false;
                        }
                    }
                });
            }

            var icon_width = 24;
            colName = colName.concat([
                (options.isClaimGrid ? '<input type="checkbox" title="Select all studies" id="chkStudyHeader_' + filterID + '" class="chkheader" onclick="commonjs.checkMultiple(event)" />' : ''),
                '', '', '', '', '','',''

            ]);

            i18nName = i18nName.concat([
                '', '', '', '', '', '','',''
            ]);

            colModel = colModel.concat([
                {
                    name: 'as_chk',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    isIconCol: true,
                    formatter: function (cellvalue, options, rowObject) {
                        return '<input type="checkbox" name="chkStudy" id="chk'+gridID.slice(1)+'_' + (options.isClaimGrid?rowObject.id:rowObject.id )+ '" />'
                    },
                    customAction: function (rowID, e, that) {
                    }
                },
                {
                    name: 'as_edit',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: false,
                    isIconCol: true,
                    formatter: function () {
                        return "<i class='icon-ic-edit' title='Edit'></i>"
                    },
                    customAction: function (rowID, e, that) { 
                        if(options.isClaimGrid){
                            self.claimView = new claimsView();
                            self.claimView.showEditClaimForm(rowID);
                            return false;
                        }else{
                            window.localStorage.setItem('selected_studies', null);
                            window.localStorage.setItem('first_study_details', null);
                            window.localStorage.setItem('primary_study_details', JSON.stringify(selectedStudies[0]));
                            window.localStorage.setItem('selected_studies', JSON.stringify(studyIds));
                            self.claimView = new claimsView();
                            self.claimView.showClaimForm(studyIds);
                            return false;
                        }
                    }
                },
                {
                    name: 'as_claim_inquiry',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: !options.isClaimGrid,
                    isIconCol: true,
                    formatter: function () {
                        return "<i class='icon-ic-raw-transctipt' title='Claim Inquiry'></i>"
                    },
                    customAction: function (rowID, e, that) {
                        commonjs.showDialog({
                            'header': 'Claim Inquiry',
                            'width': '95%',
                            'height': '85%',
                            'needShrink': true
                        });
                        self.claimInquiryView = new claimInquiryView({ el: $('#modal_div_container') });
                        self.claimInquiryView.render(rowID);                       
                    }
                },
                {
                    name: 'account_no',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'birth_date',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'patient_name',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'patient_id',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
                {
                    name: 'billing_method',
                    width: 20,
                    sortable: false,
                    resizable: false,
                    search: false,
                    hidden: true,
                    isIconCol: true
                },
            ]);

            if (app.showserial) {
                colName.push('#');
                i18nName.push('');
                colModel.push({
                    name: 'record_no',
                    width: 25,
                    sortable: false,
                    search: false,
                    resizable: false
                });
            }

            var gridIDPrefix = '#jqgh_' + gridID.slice(1);

            var subGridNeed = ((app.showpriors && true) || true);
            var studyFieldsCollection = new StudyFields(null, { gridOptions: null, field_order: userSettings.field_order, filterType: userSettings.grid_name });
            var studyFields = studyFieldsCollection.reduce(function (fieldSet, field) {
                fieldSet.colName[fieldSet.colName.length] = field.get('field_name');
                fieldSet.i18nName[fieldSet.i18nName.length] = field.get('i18n_name') || '';
                fieldSet.colModel[fieldSet.colModel.length] = field.get('field_info');
                return fieldSet;
            }, {
                    'colName': [],
                    'i18nName': [],
                    'colModel': []
                });
            var defSortOrder = userSettings.default_column_order_by || "asc";
            var defColumn = studyFieldsCollection.findWhere({
                'field_name': userSettings.default_column !== 'ID' ?
                    userSettings.default_column :
                    'Study Received Date'
            });

            var defSortColumn = userSettings.default_column;

            app.usersettings.wl_sort_field = defSortColumn;

            var afterInsertRow = function (rowid, rowdata) {
                var $row = $tblGrid.find('#' + rowid);
                var setCell = changeGrid.setCell($row);
                var cells = [];

                cells = cells.concat(changeGrid.getPrior(rowdata));
                cells = cells.concat(changeGrid.getRefPhy(rowdata));
                cells = cells.concat(changeGrid.getReferringProviders(rowid, rowdata));
                cells = cells.concat(changeGrid.getReadPhy(rowid, rowdata));
                cells = cells.concat(changeGrid.getAge(rowdata.patient_age));
                setCell(cells);

                if (typeof options.afterInsertRow === 'function') {
                    options.afterInsertRow(rowid, rowdata);
                }
            };

            var afterGridBind = function (model, gridObj) {
                if (typeof options.updateStudiesPager === 'function') {
                    options.updateStudiesPager(model, gridObj);
                }

            };

            var rowattr = function (domData, data) {
                var attrs = {
                    'class': '',
                    'style': ''
                };

                if (isTrue(data.has_deleted) || isFalse(data.is_active)) {
                    attrs['class'] += 'inActiveRow';
                }

                if (isNotTrue(data.has_deleted) && data.current_status_waiting_time > 0 && data.max_waiting_time > 0 && (data.max_waiting_time > data.current_status_waiting_time)) {
                    attrs['class'] += 'warnExceedTime';
                    attrs['data_interval'] = 1;
                }

                var stat = data.stat_level;
                if (stat) {
                    var css = changeGrid.getStatLevelAttr(stat);
                    attrs.style += 'background-color:' + css.bgColor + ';color:' + css.textColor + ';';
                }

                return attrs;
            };

            $('#mySettings').unbind().click(function (e) {

                commonjs.showDialog(
                    {
                        "width": "50%",
                        "height": "70%",
                        "header": "User Settings",
                        "needShrink": true,
                        "html": "<div/>"
                    });

                self.UserSettingsView = new UserSettingsView({ el: $('#modal_div_container') });
                self.UserSettingsView.render();
            });

            $('#btnStudyFilter').unbind().click(function (e) {
                
                commonjs.showDialog(
                    {
                        "width": "75%",
                        "height": "75%",
                        "header": window.location && window.location.hash.split('/')[1] == 'claim_workbench' ? "Claim Filter" : "Study Filter",
                        "needShrink": true,
                        "html": "<div/>"
                    });

                    self.StudyFilterView = new StudyFilterView({el: $('#modal_div_container')});
                    self.StudyFilterView.showGrid();
                    $('#tblStudyFilterGrid').append(self.template);
            });
            claimsTable.render({
                gridelementid: gridID,
                custompager: new Pager(),
                colNames: colName.concat(studyFields.colName),
                i18nNames: i18nName.concat(studyFields.i18nName),
                colModel: colModel.concat(studyFields.colModel),
                emptyMessage: 'No Study found',
                sortname: defSortColumn,
                sortorder: defSortOrder,
                caption: "Studies",
                idprefix: isTrue(options.showEncOnly) ? "" : "st",
                disableautowidthresize: false,
                disableautoheightresize: false,
                container: options.container,
                multiselect: true,
                ondblClickRow: function (rowID, irow, icol, event) {
                    var data = getData(rowID, studyStore, gridID);
                    if ($('#chk'+gridID.slice(1)+'_' + rowID).length > 0) {
                        $('#chk'+gridID.slice(1)+'_' + rowID).attr('checked',true);
                    }
                    if (options.isClaimGrid) {
                        self.claimView = new claimsView();
                        self.claimView.showEditClaimForm(rowID);
                    } else {
                        window.localStorage.setItem('selected_studies', null);
                        window.localStorage.setItem('first_study_details', null);
                        window.localStorage.setItem('primary_study_details', JSON.stringify(rowID));
                        window.localStorage.setItem('selected_studies', JSON.stringify(rowID));
                        self.claimView = new claimsView();
                        self.claimView.showClaimForm(rowID);
                    }
                },
                disablesearch: false,
                disablesort: false,
                disablepaging: true,
                disableadd: true,
                showcaption: false,
                offsetHeight: '10',
                customizeSort: true,
                sortable: {
                    exclude: [
                        ',',
                        gridIDPrefix,
                        '_as_chk,'
                    ].join(''),
                    update: function (permutation, gridObj) {
                        var colModel = gridObj && gridObj.p ?
                            gridObj.p.colModel :
                            $tblGrid.jqGrid('getGridParam', 'colModel');
                        studyFieldsCollection.sort(colModel.filter(function (col) {
                            return col.hasOwnProperty('custom_name');
                        }));
                        updateReorderColumn(studyFieldsCollection.toJSON());
                    }
                },

                isSearch: true,
                shrinkToFit: false,
                autowidth: false,
                isPrior: options.isPrior,
                isDicomSearch: options.isDicomSearch,
                showEncOnly: options.showEncOnly,
                providercontact_ids: app.providercontact_ids,
                searchByAssociatedPatients: userSettings.searchByAssociatedPatients,
                isRisOrderSearch: options.isRisOrderSearch,
                isClaimGrid: options.isClaimGrid,

                onRightClickRow: function (rowID, iRow, iCell, event, options) {
                    if (disableRightClick()) {
                        var _selectEle = $(event.currentTarget).find('#' + rowID).find('input:checkbox');
                            _selectEle.attr('checked', true);
                        openCreateClaim(rowID, event, options.isClaimGrid, studyStore);
                    }
                    else {
                        event.stopPropagation();
                    }
                },
                beforeSelectRow: function (rowID, e) {
                    var _selectEle = $(e.currentTarget).find('#' + rowID).find('input:checkbox');
                    var enableField = _selectEle.is(':checked')
                    _selectEle.attr('checked', !enableField);
                  
                },
                beforeSearch: function () {
                    commonjs.scrollLeft = $('.ui-jqgrid-bdiv').scrollLeft();
                },

                resizeStop: function (newWidth, index, gridObj) {
                    var colModel = gridObj && gridObj.p ?
                        gridObj.p.colModel :
                        $tblGrid.jqGrid('getGridParam', 'colModel');
                    var col = colModel[index];
                    if (!col) {
                        commonjs.showWarning('Could not save new column size');
                        return false;
                    }
                    studyFieldsCollection.add({
                        'id': col.custom_id,
                        'field_info': {
                            'width': col.width
                        }
                    }, { 'merge': true });
                    updateResizeColumn(studyFieldsCollection.toJSON());
                },
                afterInsertRow: afterInsertRow,
                onbeforegridbind: updateCollection,
                onaftergridbind: afterGridBind,
                defaultwherefilter: '',
                customargs: {
                    flag: 'home_study',
                    isPrior: options.isPrior,
                    filter_id: filterID,
                    study_id: options.study_id,
                    isExceedsMaxTime: filterID,
                    showdeletedstudies: true,
                    isDicomSearch: options.isDicomSearch,
                    showEncOnly: options.showEncOnly,
                    isRisOrderSearch: options.isRisOrderSearch,
                    providercontact_ids: [],
                    searchByAssociatedPatients: userSettings.searchByAssociatedPatients,
                    patient_id: 0,
                    study_dt: (commonjs.prior_study_dt) ?
                        commonjs.prior_study_dt :
                        null,
                    order_id: (commonjs.prior_order_id > 0) ?
                        commonjs.prior_order_id :
                        0
                },
                rowattr: rowattr
            });
        };
        self.setDropDownSubMenuPosition = function (e, divObj) {
            var mouseX = e.clientX;
            var mouseY = e.clientY;
            var windowWidth = $window.width();
            var windowHeight = $window.height();
            var $divObj = $(document.getElementById(divObj));
            var menuWidth = $divObj.outerWidth();
            var menuHeight = $divObj.outerHeight();
            var list = $(e.target.parentElement).find('ul')[0];
            var subMenuWidth = $(list).width();
            var subMenuHeight = $(list).height();
            if (mouseX + menuWidth + subMenuWidth > windowWidth) {
                $(list).css('left', '-100%');
                list.style.float = 'left';
            }

        };
    };
});
