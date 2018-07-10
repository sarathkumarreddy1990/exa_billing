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
	'text!templates/app/eraProcessedResponse.html'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, eraGrid, eraProgress, EraPreview, eraLists, EobFilesPager, EraResponse) {
        var eraView = Backbone.View.extend({

            eraGridTemplate: _.template(eraGrid),
            eraResponseTemplate: _.template(EraResponse),
            eraProgressTemplate: _.template(eraProgress),
            subGridFilesTable: null,
            subGridPager: null,
            eobStatus: { "": "All", "pending": "Pending", "in_progress": "In Progress", "success": "Success", "failure": "Failure", "RP": "Ready for Processing" },
            parent_file_id: 0,

            events: {
                'click #btnProcessERA': 'processERAFile',
                'click #btnReloadERA': 'reloadERAFiles',
                'click #btnReloadERALocal': 'reloadERAFilesLocal',
                'change #myFile': 'processSelectedERAFile'
            },

            initialize: function (options) {
                this.options = options;
                var _self = this;
                this.pager = new EobFilesPager();
                this.eraLists = new eraLists();
                app.fileStoreId = 1;
                app.settings.eraInboxPath = 'D:eraInbox';
            },

            showGrid: function () {
                var self = this;
                commonjs.showLoading();
                $(this.el).html(this.eraGridTemplate());
                self.getEobFilesList();
                commonjs.currentModule = 'EOB';
                commonjs.initializeScreen({ header: { screen: 'ERA', ext: 'eob' } });
                commonjs.hideLoading();
            },

            reloadERAFilesLocal: function () {
                this.pager.set({ "PageNo": 1 });
                $('.ui-jqgrid-htable:visible').find('input, select').val('');

                this.eobFilesTable.refresh();

                var fileUploadedObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileNameUploaded');
                var fileDuplicateObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileIsDuplicate');

                fileDuplicateObj.innerHTML = '';
                fileUploadedObj.innerHTML = '';
            },

            getEobFilesList: function () {
                var self = this;
                var offsetHeight = (commonjs.currentModule == "Setup") ? '30' : '0';
                this.eobFilesTable = new customGrid();
                this.eobFilesTable.render({
                    gridelementid: '#tblEOBFileList',
                    custompager: this.pager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', 'Id', 'File Name', 'Size', 'File Updated Date/Time', 'Status'],
                    i18nNames: ['', '', '', 'home.pendingStudies.fileName', 'home.viewerCommonOptions.size', 'home.pendingStudies.fileUpdatedDateTime', 'shared.fields.status'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true, searchFlag: '%', search: false },
                        { name: 'file_store_id', hidden: true, searchFlag: '%', search: false },
                        {
                            name: 'edit', width: 40, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                return "<a href='javascript: void(0)' id =" + rowObject.id + ">View</a>";
                            },
                            cellattr: function () {
                                return "style='text-align: center;text-decoration: underline;'";
                            },
                            customAction: function (rowID, e) {
                                var gridData = $('#tblEOBFileList').jqGrid('getRowData', rowID);
                                if ('success' == gridData.current_status) {
                                    self.showPayments(rowID, gridData.uploaded_file_name);
                                }
                                else {
                                    commonjs.showWarning('File not in Success status');
                                }

                            }
                        },
                        { name: 'id', index: 'id', searchFlag: 'int', searchFlag: '%' },
                        { name: 'uploaded_file_name', width: 400, searchFlag: 'hstore', searchoptions: { defaultValue: commonjs.filterData['uploaded_file_name'] } },
                        {
                            name: 'size', width: 100, search: false, searchoptions: { defaultValue: commonjs.filterData['size'] }, formatter: function (cellvalue, options, rowObject) {
                                return self.fileSizeTypeFormatter(cellvalue, options, rowObject);
                            }
                        },
                        {
                            name: 'updated_date_time', width: 200, searchFlag: 'hstore', searchoptions: { defaultValue: commonjs.filterData['updated_date_time'] }, formatter: function (cellvalue, options, rowObject) {
                                return self.fileUpdatedDateFormatter(cellvalue, options, rowObject);
                            }
                        },
                        {
                            name: 'current_status', width: 200, stype: 'select',
                            searchoptions: { value: self.eobStatus, defaultValue: commonjs.filterData['current_status'] },
                            edittype: 'select', editoptions: { value: self.eobStatus },
                            cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                return 'style=text-transform: capitalize;'
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
                    customargs: {
                        showParentFileOnly: true,
                        companyID: app.companyID
                    },
                    onaftergridbind: function (model, gridObj) {
                        self.afterEraGridBind(model, gridObj, self);
                    },
                    ondblClickRow: function (rowID) {
                        var gridData = $('#tblEOBFileList').jqGrid('getRowData', rowID);
                        if (['failure', 'success'].indexOf(gridData.current_status) == -1) {
                            self.processFile(rowID, gridData, null);
                        }
                        else {
                            commonjs.showWarning('File already processed');
                        }
                    }
                });
            },

            afterEraGridBind: function (dataset, e, self) {
                var fileUploadedObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('fileNameUploaded');

                if (fileUploadedObj && fileUploadedObj.innerHTML)
                    $('#tblEOBFileList #' + fileUploadedObj.innerHTML).dblclick();
            },

            fileUpdatedDateFormatter: function (cellvalue, options, rowObject) {
                return rowObject.updated_date_time ? moment(rowObject.updated_date_time).format('L, h:mm a') : ''
            },

            fileSizeTypeFormatter: function (cellvalue, options, rowObject) {
                var i = parseInt(Math.floor(Math.log(rowObject.size) / Math.log(1024)));
                var sizes = ['Bytes', 'KB'];
                return Math.round(rowObject.size / Math.pow(1024, i), 2) + ' ' + sizes[i];
            },

            eobStatusFormatter: function (cellvalue, options, rowObject) {
                return rowObject.updated_date_time ? moment(rowObject.updated_date_time).format('L, h:mm a') : ''
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
                $.ajax({
                    url: '/exa_modules/billing/era/process-file',
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

                        var array_to_object = function ($value) {
                            return isArray($value) ? array_to_object($value[0]) : $value;
                        }

                        if (model && model != undefined) {

                            model = model && model.length ? array_to_object(model) : model;

                            if (model && model.status == 100) {
                                commonjs.showWarning(model.message);
                            }
                            else if (model && model.payer_id) {

                                model.file_store_id = gridData.file_store_id;
                                self.showProgressDialog(file_id, model, 'initialize');
                            }
                            else if (model && model.rows && model.rows.length) {
                                commonjs.hideDialog();
                                self.reloadERAFilesLocal();
                            } else if (model && model.type && model.type == 'none') {
                                model.file_store_id = gridData.file_store_id;
                                self.showProgressDialog(file_id, model, 'initialize');
                            }
                            else if (model && model.name == 'error') {
                                var msg = model.table + ' ' + model.detail
                                commonjs.showWarning(msg);
                                //commonjs.showWarning('Already Payment Processed');
                            }
                            $('#btnProcessPayment').prop('disabled', false);
                        }

                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            showProgressDialog: function (file_id, payerDetails, isFrom) {
                var self = this;
                if (isFrom == 'initialize') {

                    commonjs.hideLoading();
                    commonjs.showDialog({ header: 'EOB', width: '45%', height: '60%', html: self.eraProgressTemplate() });
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
                        commonjs.showWarning('Please select Insurance provider');
                    } else {
                        self.processFile(file_id, payerDetails, 'applypayments');
                    }
                });

                $('.modal-dialog .btn-secondary, .modal-dialog  .close').off().click(function (e) {
                    self.reloadERAFilesLocal();
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
                                company_id: 1
                            };
                        },
                        processResults: function (data, params) {
                            params.page = params.page || 1;
                            return {
                                results: data,
                                pagination: {
                                    more: (params.page * 30) < data[0].total_records
                                }
                            };
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
                
                var hdnPreviewFileName = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('hdnPreviewFileName');

                if(hdnPreviewFileName && hdnPreviewFileName.innerHTML && hdnPreviewFileName.innerHTML.length > 0) {
                    this.showEraPreview(hdnPreviewFileName.innerHTML);
                    hdnPreviewFileName.innerHTML = '';
                    return;
                }

                if (fileDuplicateObj.innerHTML == 'true') {
                    commonjs.showWarning('This file has been already processed');
                    fileDuplicateObj.innerHTML = '';
                    fileUploadedObj.innerHTML = '';
                    return false;
                }
                else {
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

                            commonjs.showDialog({ header: 'EOB Preview', width: '60%', height: '60%', html: previewHtml }, true);
                        } catch (err) {
                            commonjs.showError('Unable to process');
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                })
            },

            showPayments: function (fileId, fileName) {
                var self = this;
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

                            if (model && model.rows.length) {
                                var $eraTable = $('#eraResultTable');
                                fileName = fileName.substr(0, fileName.lastIndexOf('.'));
                                
                                var ins = model.rows[0];
                                var claims = [];

                                var claimDetails = ins.claimsDetails;
                                var chargeDetails = ins.chargeDetails;

                                var totalBillFee = 0.00;
                                var totalAllowedFee = 0.00;
                                $.each(claimDetails, function (index, row) {
                                    totalBillFee = 0.00;
                                    totalAllowedFee = 0.00;
                                    row["charges"] = [];
                                    for (var j = 0; j < chargeDetails.length; j++) {
                                        if (row.claim_id === chargeDetails[j].claim_id) {
                                            totalBillFee += parseFloat(chargeDetails[j].bill_fee.substr(1));
                                            totalAllowedFee += parseFloat(chargeDetails[j].allowed_fee.substr(1));
                                            row["charges"].push(chargeDetails[j]);
                                        }
                                    }
                                    claims.push(row);
                                    row["totalBillFee"] = totalBillFee;
                                    row["totalAllowedFee"] = totalAllowedFee;
                                });

                                $('#eraResultTitle').html('Result : ' + fileName);
                                $('#divEraResponse').html(self.eraResponseTemplate({ claims: claims, ins: ins }));
                                $('#divResponseSection').height($(window).height() - 350);
                                commonjs.showDialog({ header: 'Result : ' + fileName, width: '80%', height: '70%', html: $('#divEraResponse').html() });
                            }
                            else {
                                commonjs.showWarning('No details to show');
                            }
                        },
                        error: function (err, response) {
                            commonjs.handleXhrError(err, response);
                        }
                    });
                } else {
                    commonjs.showWarning('Error on getting file id');
                }


                $('.btnCloseEraResultDiv').off().click(function (e) {
                    $("#divEraResult").hide();
                });
            }
        });
        return eraView;
    });