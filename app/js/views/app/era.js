define([
    'jquery',
    'immutable',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'text!templates/app/eraGrid.html',
    'text!templates/app/era-progress.html',
    'collections/app/era',
    'models/pager'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, eraGrid, eraProgress, eraLists, EobFilesPager) {
        var eraView = Backbone.View.extend({

            eraGridTemplate: _.template(eraGrid),
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
                    colNames: ['', '', '', 'File Name', 'Size', 'File Updated Date/Time', 'Status'],
                    i18nNames: ['', '', 'home.pendingStudies.fileName', 'home.viewerCommonOptions.size', 'home.pendingStudies.fileUpdatedDateTime', 'shared.fields.status'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true, searchFlag: '%', search: false },
                        { name: 'file_store_id', hidden: true, searchFlag: '%', search: false },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                return '<input type="radio" class="studyChk" name="chkStudy" id="' + rowObject.id + '" />'
                            }
                        },
                        { name: 'file_name', width: 400, searchFlag: 'hstore', searchoptions: { defaultValue: commonjs.filterData['file_name'] } },
                        {
                            name: 'size', width: 100, searchFlag: 'hstore', searchoptions: { defaultValue: commonjs.filterData['size'] }, formatter: function (cellvalue, options, rowObject) {
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
                        self.processFile(rowID, gridData, null);
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

                $.ajax({
                    url: '/exa_modules/billing/era/process-file',
                    type: "POST",
                    dataType: 'json',
                    data: {
                        status: currentStatus || gridData.current_status,
                        //file_store_id: gridData.file_store_id,
                        file_id: file_id || null,
                        payer_details: payerDetails,
                        company_id: app.companyID
                    },
                    success: function (model, response) {
                        console.log(model);
                        model = model.length  && model[0].length ? model[0][0] : model[0];
                        
                        if (model.status == 100) {
                            commonjs.showWarning(model.message);
                        }
                        else if (model && model.payer_id) {
                            
                            model.file_store_id = gridData.file_store_id;
                            self.showProgressDialog(file_id, model, 'initialize');
                        }
                        else if (model && model.rows && model.rows.length) {
                            var processedClaims = model.rows[0].insert_edi_file_claims ? model.rows[0].insert_edi_file_claims : [];
                            _.each(processedClaims, function (dataResult, index) {
                                var status = dataResult.applied ? 'DONE' : 'FAILED';
                                $('#eraProcessTable').append('<tr><td>' + dataResult.edi_file_id + '</td><td>' + dataResult.claim_number + '</td><td>' + status + '</td></tr>');
                            });
                            if (processedClaims.length == 0) {
                                $('#eraProcessTable').append('<tr><td>Payment failed for all claims</td></tr>');
                            }
                            $('#divEraProcess').show();
                            $('#btnProcessPayment').prop('disabled', true);

                        } else if (model && model.type && model.type == 'none') {
                            model.file_store_id = gridData.file_store_id;
                            self.showProgressDialog(file_id, model, 'initialize');
                        }
                        else if (model.name =='error') {
                            var msg =  model.table +' '+ model.detail 
                            commonjs.showWarning(msg);
                            commonjs.showWarning('Already Payment Processed');
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
                    if(!$('#select2-ddlInsuranceProviders-container').attr('data_description') || !$('#select2-ddlInsuranceProviders-container').attr('data_id')){
                        commonjs.showWarning('Please select Insurance provider');
                    }else{
                        self.processFile(file_id, payerDetails, 'applypayments');
                    }
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
            }
        });
        return eraView;
    });