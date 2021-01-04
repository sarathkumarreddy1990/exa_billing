define([
    'jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/app/eraGrid.html',
    'text!templates/app/era-progress.html',
    'text!templates/app/era-preview.html',
    'collections/app/era',
    'models/pager',
	'text!templates/app/era-processed-response.html'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, eraGrid, eraProgress, EraPreview, eraLists, EobFilesPager, EraResponse) {
        var eraView = Backbone.View.extend({

            eraGridTemplate: _.template(eraGrid),
            eraResponseTemplate: _.template(EraResponse),
            eraProgressTemplate: _.template(eraProgress),
            subGridFilesTable: null,
            subGridPager: null,
            eobStatus: { "": "All", "pending": "Pending", "in_progress": "In Progress", "success": "Success", "failure": "Failure", "RP": "Ready for Processing" },
            parent_file_id: 0,
            uploadMode : null,
            events: {
                'click #btnProcessERA': 'processERAFile',
                'click #btnReloadERA': 'reloadERAFiles',
                'click #btnReloadERALocal': 'reloadERAFilesLocal',
                'change #myFile': 'processSelectedERAFile'
            },
            isCleared: false,

            initialize: function (options) {
                this.options = options;
                var _self = this;
                this.pager = new EobFilesPager();
                this.eraLists = new eraLists();
            },

            showGrid: function () {
                var self = this;
                commonjs.showLoading();
                $(this.el).html(this.eraGridTemplate());
                self.getEobFilesList();
                commonjs.currentModule = 'EOB';
                document.getElementById("ifrEobFileUpload").addEventListener('load', function (e) {
                    var elList = this.contentWindow.document.querySelectorAll("[i18n]");
                    if (elList.length > 0) {
                        for (var i = 0; i < elList.length; i++) {
                            i18n.t1(elList[i]);
                        }
                    }
                });
                commonjs.initializeScreen({ header: { screen: 'ERA', ext: 'eob' } });
                commonjs.hideLoading();
            },

            reloadERAFilesLocal: function () {
                this.pager.set({ "PageNo": 1 });
                $('.ui-jqgrid-htable:visible').find('input, select').val('');

                this.eobFilesTable.refresh();

                var fileUploadedObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileNameUploaded');
                var fileDuplicateObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileIsDuplicate');
                var fileStoreExist = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileStoreExist');

                if (fileDuplicateObj) fileDuplicateObj.innerHTML = '';
                if (fileUploadedObj) fileUploadedObj.innerHTML = '';
                if (fileStoreExist) fileStoreExist.innerHTML = '';
            },

            getEobFilesList: function () {
                var self = this;
                var offsetHeight = (commonjs.currentModule == "Setup") ? '30' : '0';
                this.eobFilesTable = new customGrid();
                this.eobFilesTable.render({
                    gridelementid: '#tblEOBFileList',
                    custompager: this.pager,
                    emptyMessage: commonjs.geti18NString("messages.status.noRecordFound"),
                    colNames: ['', '', '', '', 'Id', 'Payment Id','File Name', 'Size', 'File Updated Date/Time', 'Status'],
                    i18nNames: ['', '', '', '', 'shared.fields.id', 'shared.fields.paymentId','shared.fields.fileName', 'shared.fields.size', 'shared.fields.fileUpdatedDateTime', 'shared.fields.status'],
                    colModel: [
                        { name: 'file_store_id', hidden: true, searchFlag: '%', search: false },
                        {
                            name: 'edit', width: 40, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                return "<a href='javascript: void(0)' id =" + rowObject.id + ">" + commonjs.geti18NString('shared.buttons.view') + "</a>";
                            },
                            cellattr: function () {
                                return "style='text-align: center;text-decoration: underline;'";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblEOBFileList').jqGrid('getRowData', rowID);
                                if ('success' === gridData.current_status.toLowerCase()) {
                                    self.showPayments(rowID, gridData.uploaded_file_name);
                                }
                                else {
                                    commonjs.showWarning('messages.status.fileNotInSuccessStatus');
                                }
                            }
                        },
                        {
                            name: 'eob_file_id', width: 80, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                if (rowObject.payment_id && cellvalue) {
                                    return "<a href='javascript: void(0)' id =" + cellvalue + " name='viewPDF' style='text-align: center;text-decoration: underline;' i18n='shared.buttons.viewPDF'></a>";
                                } else if (rowObject.payment_id && !cellvalue) {
                                    return "<a href='javascript: void(0)' id =" + rowObject.id + " name='uploadPDF' style='text-align: center;text-decoration: underline;' i18n='shared.buttons.uploadPDF'></a>";
                                }

                                return "";
                            },
                            customAction: function (rowID, e) {
                                if (e.target.name === 'viewPDF') {
                                    commonjs.showDialog({
                                        url: '/exa_modules/billing/era/eob_pdf?file_id=' + e.target.id + '&company_id=' + app.companyID,
                                        width: '80%',
                                        height: '80%',
                                        header: 'EOB',
                                        i18nHeader: "billing.payments.eob"
                                    });
                                } else if (e.target.name === 'uploadPDF') {
                                    self.uploadMode = 'PDF';
                                    var iframe = $('#ifrEobFileUpload')[0];
                                    iframe.contentWindow.fireUpload(e);
                                }
                            }
                        },
                        {
                            name: 'decode_file',
                            width: 180,
                            sortable: false,
                            search: false,
                            hidden: app.billingRegionCode !== 'can_MB',
                            formatter: function (cellvalue, options, rowObject) {
                                return rowObject.file_path.indexOf('Returns') > -1 ? "<a name='decode' href='javascript: void(0)'  style='text-align: center;text-decoration: underline;' data-path= "+ rowObject.uploaded_file_name +" i18n='shared.buttons.decodeOutput'></a>" : '';
                            },
                            customAction: function(rowID, event, gridObj) {
                                var fileName = event.target.dataset.path;
                                self.downloadEobJson(fileName, rowID, gridObj);
                            }
                        },
                        { name: 'id', index: 'id',  width: 50, searchFlag: 'int', searchFlag: '%' },
                        { name: 'payment_id', width: 100, searchFlag: '%', paymentIDFormatter: true },
                        { name: 'uploaded_file_name', width: 300, searchFlag: 'hstore', searchoptions: { defaultValue: commonjs.filterData['uploaded_file_name'] } },
                        {
                            name: 'size', width: 100, search: false, searchoptions: { defaultValue: commonjs.filterData['size'] }, formatter: function (cellvalue, options, rowObject) {
                                return self.fileSizeTypeFormatter(cellvalue, options, rowObject);
                            }
                        },
                        {
                            name: 'updated_date_time', width: 200, searchFlag: 'date', formatter: function (cellvalue, options, rowObject) {
                                return self.fileUpdatedDateFormatter(cellvalue, options, rowObject);
                            }
                        },
                        {
                            name: 'current_status', width: 200, stype: 'select',
                            searchoptions: { value: self.eobStatus, defaultValue: commonjs.filterData['current_status'] },
                            edittype: 'select', editoptions: { value: self.eobStatus },
                            cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                return 'style=text-transform: capitalize;'
                            },formatter: function (cellvalue, options, rowObject) {
                                return self.eobStatusFormatter(cellvalue, options, rowObject);
                            }
                        }
                    ],
                    pager: '#gridPager_EOBFileList',
                    customizeSort: true,
                    sortname: "updated_date_time",
                    sortorder: "DESC",
                    caption: "EOB Files",
                    datastore: this.eraLists,
                    container: this.el,
                    dblClickActionIndex: 0,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    offsetHeight: offsetHeight,
                    disableautoheightresize: true,
                    height: $('#body_content').height() - 220,
                    sortable: {
                        exclude: ',#jqgh_tblEOBFileList_edit,#jqgh_tblEOBFileList_file_store_id'
                    },
                    customargs: {
                        showParentFileOnly: true,
                        companyID: app.companyID,
                        options: {
                            isCompanyBase: true
                        },
                        toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                        fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : ""
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.afterEraGridBind(model, gridObj, self);
                        self.setPhoneMask();
                        self.bindDateRangeOnSearchBox(gridObj);
                    },
                    ondblClickRow: function (rowID) {
                        var gridData = $('#tblEOBFileList').jqGrid('getRowData', rowID);
                        if (['failure', 'success'].indexOf(gridData.current_status.toLowerCase()) == -1) {
                            self.processFile(rowID, gridData, null);
                        }
                        else {
                            commonjs.showWarning('messages.warning.era.fileAlreadyProcessed');
                        }
                    }
                });
            },

            eobStatusFormatter: function (cellvalue, options, rowObject) {
                switch (rowObject.current_status) {
                    case "pending":
                        return "Pending";
                    case "in_progress":
                        return "In Progress";
                    case "failure":
                        return "Failure";
                    case "success":
                        return "Success";
                    case "RP":
                        return "Ready for Processing";
                    default :
                        return '';
                }
            },

            //Bind default date range on updated date time column
            searchEraFiles: function () {
                var self = this;
                self.pager.set({"PageNo": 1});
                self.eobFilesTable.options.customargs = {
                    showParentFileOnly: true,
                    options: {
                        isCompanyBase: true
                    },
                    toDate: !self.isCleared ? moment().format('YYYY-MM-DD') : "",
                    fromDate: !self.isCleared ? moment().subtract(29, 'days').format('YYYY-MM-DD') : ""
                };
                self.eobFilesTable.refresh();
            },

            //Bind date range filter
            bindDateRangeOnSearchBox: function (gridObj) {
                var self = this;
                var columnsToBind = ['updated_date_time'];
                var drpOptions = {
                    locale: {
                        format: "L"
                    }
                };
                var currentFilter = 1;

                _.each(columnsToBind, function (col) {
                    var colSelector = '#gs_' + col;
                    var colElement = $(colSelector);

                    if (!colElement.val() && !self.isCleared) {
                        var toDate = moment(),
                            fromDate = moment().subtract(29, 'days');
                        colElement.val(fromDate.format("L") + " - " + toDate.format("L"));
                    }

                    var drp = commonjs.bindDateRangePicker(colElement, drpOptions, "past", function (start, end, format) {
                        if (start && end) {
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
                    colElement.on("apply.daterangepicker", function (obj) {
                        gridObj.refresh();
                    });
                    colElement.on("cancel.daterangepicker", function () {
                        self.isCleared = true;
                        self.searchEraFiles();
                    });
                });
            },

            afterEraGridBind: function (dataset, e, self) {
                var fileUploadedObj = document && document.getElementById("ifrEobFileUpload") && document.getElementById("ifrEobFileUpload").contentWindow
                    && document.getElementById("ifrEobFileUpload").contentWindow.document && document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileNameUploaded');

                if (fileUploadedObj && fileUploadedObj.innerHTML && this.uploadMode !== 'PDF') {
                    $('#tblEOBFileList tr#' + fileUploadedObj.innerHTML).off().dblclick();
                    fileUploadedObj.innerHTML = '';
                }
                this.uploadMode = null;
                if (layout.currentModule !== 'Payments') {
                    this.showERAButtons();
                }
            },

            showERAButtons: function() {
                var ifrDoc = $("ifrEobFileUpload").contents();

                if (ifrDoc) {
                    $(ifrDoc).find('#btnProcess_EOB, #btnPreview_EOB').css('display', 'block');
                }
            },

            setPhoneMask: function (obj1, obj2) {
                $(".ui-jqgrid-htable thead:first tr.ui-search-toolbar input[name=id]").addClass('integerbox');
                commonjs.validateControls();
            },

            fileUpdatedDateFormatter: function (cellvalue, options, rowObject) {
                return rowObject.updated_date_time ? moment(rowObject.updated_date_time).format('L h:mm a') : ''
            },

            fileSizeTypeFormatter: function (cellvalue, options, rowObject) {
                var i = parseInt(Math.floor(Math.log(rowObject.size) / Math.log(1024)));
                var sizes = ['Bytes', 'KB'];
                return Math.round(rowObject.size / Math.pow(1024, i), 2) + ' ' + sizes[i];
            },

            processFile: function (file_id, gridData, currentStatus) {
                var self = this

                var $InsuranceProvider = $('#select2-ddlInsuranceProviders-container') || null;

                var payerDetails = JSON.stringify({
                    payer_id: $InsuranceProvider.attr('data_id') || null,
                    payer_name: $InsuranceProvider.attr('data_description') || null,
                    payer_code: $InsuranceProvider.attr('data_code') || null,
                    created_by: app.userID,
                    company_id: app.companyID
                });

                $('#btnProcessPayment').prop('disabled', true);
                commonjs.showLoading();
                $.ajax({
                    url: self.bindProvinceBasedUrl(app.billingRegionCode),
                    type: "POST",
                    dataType: 'json',
                    data: {
                        status: currentStatus || gridData.current_status,
                        file_id: file_id || null,
                        payer_details: payerDetails,
                        company_id: app.companyID,
                        facility_id: app.facilityID
                    },
                    success: function (model, response) {
                        switch(app.billingRegionCode) {
                            case 'can_MB':
                            case 'can_BC':
                                return self.processCanadaResponse(model);
                            default:
                                return self.processUsaResponse(file_id, model, gridData);
                        }
                    },
                    error: function (err, response) {
                        commonjs.hideLoading();
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            processUsaResponse: function(file_id, model, gridData) {
                var self = this;
                var array_to_object = function ($value) {
                    return isArray($value) ? array_to_object($value[0]) : $value;
                }

                model = model && model.length ? array_to_object(model) : model;

                if (model) {

                    if (model.status == 100) {
                        commonjs.showWarning(model.message);
                    } else if (model.payer_id || (model.type && model.type == 'none')) {
                        model.file_store_id = gridData.file_store_id;
                        self.showProgressDialog(file_id, model, 'initialize');
                    } else if (model.rows && model.rows.length) {
                        commonjs.hideDialog();
                        self.reloadERAFilesLocal();
                        $('.modal-dialog .btn-secondary, .modal-dialog  .close').removeClass('eraClose');
                    } else if (model.name == 'error') {
                        var msg = 'error';

                        if (model.table) {
                            msg = model.table + ' ' + model.detail;
                        } else if (model.hint) {
                            msg = model.hint;
                        }
                        commonjs.showWarning(msg);
                    }
                    $('#btnProcessPayment').prop('disabled', false);
                    commonjs.hideLoading();
                }
            },

            bindProvinceBasedUrl: function(billingRegionCode) {
                switch(billingRegionCode) {
                    case 'can_MB':
                        return '/exa_modules/billing/mhs/process-file';
                    case 'can_BC':
                        return '/exa_modules/billing/bc/process-file';
                    default:
                        return '/exa_modules/billing/era/process-file';
                }
            },

            processCanadaResponse: function (model) {
                var self = this;
                var processPaymentBtn = $('#btnProcessPayment');
                processPaymentBtn.prop('disabled', true);
                commonjs.showLoading();

                if (model && model.status == 100) {
                    return commonjs.showWarning(model.message);
                }

                if (model && model.rows && model.rows.length) {
                    commonjs.hideDialog();
                    self.reloadERAFilesLocal();
                    $('.modal-dialog .btn-secondary, .modal-dialog .close').removeClass('eraClose');
                }
                processPaymentBtn.prop('disabled', false);
                commonjs.hideLoading();
            },

            showProgressDialog: function (file_id, payerDetails, isFrom) {
                var self = this;
                if (isFrom == 'initialize') {

                    commonjs.hideLoading();
                    commonjs.showDialog({ header: 'EOB', i18nHeader:'shared.moduleheader.eob', width: '45%', height: '60%', html: self.eraProgressTemplate() });
                    $('.modal-dialog .btn-secondary, .modal-dialog  .close').addClass('eraClose');
                    $('#siteModal').removeAttr('tabindex'); //removed tabIndex attr for select2 search text can't editable
                    self.setAutoComplete();

                    $('#eobpaymentIdentifier').text(payerDetails.payer_Identification || '');
                    self.paymentIdentifier = payerDetails.payer_Identification || null;

                    if (payerDetails.payer_code || payerDetails.payer_name) {
                        $('#select2-ddlInsuranceProviders-container').html(payerDetails.payer_name).prop('title', payerDetails.payer_name).attr({ 'data_code': payerDetails.payer_code, 'data_description': payerDetails.payer_name, 'data_id': payerDetails.payer_id });
                        $("#ddlInsuranceProviders").prop("disabled", true);
                    } else {
                        $('#select2-ddlInsuranceProviders-container').html('Select Insurance Provider');
                        $("#ddlInsuranceProviders").prop("disabled", false);
                    }
                }

                $('#btnProcessPaymentCancel').off().click(function (e) {
                    commonjs.hideDialog();
                    self.reloadERAFilesLocal();
                });
                $('#btnProcessPayment').off().click(function (e) {
                    if (!$('#select2-ddlInsuranceProviders-container').attr('data_description') || !$('#select2-ddlInsuranceProviders-container').attr('data_id')) {
                        commonjs.showWarning('messages.status.pleaseSelectInsuranceProvider');
                    } else {
                        self.processFile(file_id, payerDetails, 'applypayments');
                    }
                });

                $('.eraClose').off().click(function (e) {
                    self.reloadERAFilesLocal();
                    $('.modal-dialog .btn-secondary, .modal-dialog  .close').removeClass('eraClose');
                });

            },

            setAutoComplete: function () {
                var self = this;

                $("#ddlInsuranceProviders").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurances",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "insurance_code",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select carrier',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var insurance_info = commonjs.hstoreParse(repo.insurance_info);
                    var markup = "<table><tr>";
                    markup += "<td title='" + repo.insurance_code + "(" + repo.insurance_name + ")'> <div>" + repo.insurance_code + "(" + repo.insurance_name + ")" + "</div><div>" + insurance_info.Address1 + "</div>";
                    markup += "<div>" + insurance_info.City + ", " + insurance_info.State + " " + insurance_info.ZipCode + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res.id && res.id != '0') {
                        $('#select2-ddlInsuranceProviders-container').html(res.insurance_name).prop('title', res.insurance_name).attr({ 'data_code': res.insurance_code, 'data_description': res.insurance_name, 'data_id': res.id });
                        var hstoreInfo = commonjs.hstoreParse(res.insurance_info);
                        $('#eobpaymentIdentifier').text(hstoreInfo.PayerID || '');
                        self.paymentIdentifier = hstoreInfo.PayerID || null;
                    }
                    return res.insurance_name;
                }
            },

            reloadERAFiles: function () {
                commonjs.filterData = {};
                var iframeObj = document.getElementById("ifrEobFileUpload") && document.getElementById("ifrEobFileUpload").contentWindow ? document.getElementById("ifrEobFileUpload").contentWindow : null;
                var fileUploadedObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileNameUploaded');
                var fileDuplicateObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileIsDuplicate');
                var fileStoreExist = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileStoreExist');
                var fileStatus = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileStatus');

                var hdnPreviewFileName = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('hdnPreviewFileName');

                if (layout.currentModule !== 'Payments') {
                    this.showERAButtons();
                }

                if(hdnPreviewFileName && hdnPreviewFileName.innerHTML && hdnPreviewFileName.innerHTML.length > 0) {
                    this.showEraPreview(hdnPreviewFileName.innerHTML);
                    hdnPreviewFileName.innerHTML = '';
                    return;
                }

                if (fileDuplicateObj.innerHTML == 'true') {
                    commonjs.showWarning("messages.warning.era.fileAlreadyProcessed");
                    fileDuplicateObj.innerHTML = '';
                    fileUploadedObj.innerHTML = '';
                    return false;
                } else if (fileStoreExist && fileStoreExist.innerHTML == 'FILE_STORE_NOT_EXISTS') {
                    commonjs.showWarning("messages.warning.era.fileStoreNotconfigured");
                    fileDuplicateObj.innerHTML = '';
                    fileUploadedObj.innerHTML = '';
                    fileStoreExist.innerHTML = '';
                    return false;
                } else if (fileStatus && fileStatus.innerHTML == 'INVALID_FILE') {
                    commonjs.showWarning("messages.warning.era.invalidFileFormat");
                    fileStatus.innerHTML = '';
                    fileUploadedObj.innerHTML = '';
                    fileStoreExist.innerHTML = '';
                    return false;
                } else if (fileStoreExist && fileStoreExist.innerHTML != '') {
                    commonjs.showWarning(fileStoreExist.innerHTML);
                    fileDuplicateObj.innerHTML = '';
                    fileUploadedObj.innerHTML = '';
                    fileStoreExist.innerHTML = '';
                    return false;
                } else {
                    this.pager.set({ "PageNo": 1 });
                    $('.ui-jqgrid-htable:visible').find('input, select').val('');
                    this.eobFilesTable.refreshAll();
                }
            },

            showEraPreview: function (fileName) {

                var self = this;
                commonjs.showLoading();

                $.ajax({
                    url: '/exa_modules/billing/era/era_file_preview',
                    type: "GET",
                    dataType: 'json',
                    data: {
                        f: fileName
                    },
                    success: function (eraJson, response) {
                        commonjs.hideLoading();//console.log(eraJson)

                        try {
                            var eraPreview = _.template(EraPreview);
                            var previewHtml = eraPreview({ data: eraJson });

                            commonjs.showDialog({ header: 'EOB Preview', i18nHeader:'shared.fields.eobPreview', width: '60%', height: '60%', html: previewHtml }, true);
                        } catch (err) {
                            commonjs.showError('Unable to process');
                        }
                        commonjs.initializeScreen({ header: { screen: 'ERA PREVIEW', ext: 'eob preview' } });
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            showPayments: function (fileId, fileName) {
                var self = this;
                commonjs.showLoading(commonjs.geti18NString('messages.status.generateEraPreview'));
                if (fileId) {
                    $.ajax({
                        url: '/exa_modules/billing/era/era_details',
                        type: "GET",
                        dataType: 'json',
                        data: {
                            file_id: fileId,
                            company_id: app.companyID
                        },
                        success: function (model, response) {

                            if (model && model.rows && model.rows.length) {
                                var $eraTable = $('#eraResultTable');
                                fileName = fileName.substr(0, fileName.lastIndexOf('.'));

                                var ins = model.rows[0];
                                ins.payer_details.payment_dt = moment(ins.payer_details.payment_dt).format('L');

                                $('#eraResultTitle').html(commonjs.geti18NString("shared.fields.result") + ': ' + fileName);
                                commonjs.showDialog({
                                    header: commonjs.geti18NString("shared.fields.result") + ': ' + fileName,
                                    width: '80%',
                                    height: '70%',
                                    padding: '0px',
                                    html: self.eraResponseTemplate({
                                        claims: ins.processed_eob_payments || [],
                                        ins: ins,
                                        moment: moment,
                                        billingRegionCode: app.billingRegionCode
                                    })

                                });

                                try {
                                    var eraPreview = _.template(EraPreview);
                                    ins.rawResponse = ins.rawResponse && ins.rawResponse.err ? [] : ins.rawResponse || [];
                                    var previewHtml = eraPreview({ data: ins.rawResponse });
                                    $('#era-processed-preview').html(previewHtml);
                                }
                                catch (err) {
                                    console.log(err);
                                }

                                commonjs.updateCulture(app.currentCulture, commonjs.beautifyMe);
                                $('#era-processed-preview').height(($(window).height() - 360));
                            }
                            else {
                                commonjs.showWarning('messages.status.noDetailsToShow');
                            }
                            commonjs.hideLoading();
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                } else {
                    commonjs.showWarning('messages.status.errorOnGettingFileID');
                }


                $('.btnCloseEraResultDiv').off().click(function (e) {
                    $("#divEraResult").hide();
                });
            },

            downloadEobJson: function(fileName, rowID, gridObj) {
                $.ajax({
                    url: '/exa_modules/billing/era/get_json_file',
                    type: "GET",
                    data: {
                        company_id: app.companyID,
                        file_id: rowID
                    },
                    success: function (model, response) {
                        var decodeEle = document.createElement('a');
                        decodeEle.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(model)));
                        decodeEle.setAttribute('download', fileName + '.txt');
                        decodeEle.style.display = 'none';

                        decodeEle.click();
                        commonjs.showWarning('messages.status.downloadSuccess');
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            }
        });
        return eraView;
    });
