define([
    'jquery',
    '_get',
    'backbone',
], function (
    $,
    _get,
    Backbone
) {
        return function (showNestedDialog) {

            this.pdfDetails = {
                'paper_claim_original': {
                    header: 'Paper Claim',
                    api: '/exa_modules/billing/claim_workbench/claim_json'
                },

                'paper_claim_full': {
                    header: 'Paper Claim',
                    api: '/exa_modules/billing/claim_workbench/claim_json'
                },

                'direct_invoice': {
                    header: 'Direct Billing',
                    api: '/exa_modules/billing/claim_workbench/invoice_data'
                },

                'patient_invoice': {
                    header: 'Patient Invoice',
                    api: '/exa_modules/billing/claim_workbench/invoice_data'
                },
            };

            this.print = function (templateType, claimIDs, options) {
                var self = this;
                var win = null;

                if (!this.pdfDetails[templateType]) {
                    return commonjs.showError('Not yet implemented');
                }

                if (commonjs.openPdfNewWindow) {
                    win = window.open('', '_blank');
                }

                commonjs.showLoading();

                this.getTemplate(claimIDs, templateType, function (err, template) {
                    self.getClaimObject(claimIDs, templateType, options, function (err, claimData) {

                        var discardedIDs = [];
                        var processedIDs = [];

                        if (templateType === 'direct_invoice' || templateType === 'patient_invoice') {
                            if (claimData.length === 0) {
                                return commonjs.showWarning('Unable to process..');
                            }

                            if (claimData[0].claim_details.length === 0) {
                                return commonjs.showWarning('Unable to process..');
                            }

                            processedIDs = claimData[0].claim_details.map(function (claim) { return claim.claim_no })
                        }

                        if (templateType === 'paper_claim_original' || templateType === 'paper_claim_full') {
                            processedIDs = claimData.map(function (c) { return c.claim_id });
                        }

                        if (processedIDs.length === 0) {
                            return commonjs.showWarning('Unable to process..');
                        }

                        claimIDs = claimIDs.map(Number);
                        processedIDs = processedIDs.map(Number);

                        discardedIDs = _.difference(claimIDs, processedIDs);
                        if (discardedIDs.length > 0 && !options.isOrdFac) {
                            commonjs.showWarning('Unable to process few claims - ' + discardedIDs.toString());
                        }

                        if (options && options.invoiceNo) {
                            var invoiceNo = options.invoiceNo;
                            claimData[0].invoiceNo = invoiceNo;
                            return self.preparePdfWorker(templateType, template, claimData,options);
                        }

                        self.updateClaimStatus(processedIDs, templateType, function (err, response) {
                            var invoiceNo = response.invoice_no;
                            claimData[0].invoiceNo = invoiceNo;
                            return self.preparePdfWorker(templateType, template, claimData);
                        });

                        
                    });
                });
            };

            this.preparePdfWorker = function (templateType, template, claimData,options) {
                var pdfWorker;
                var self = this;
                var docDefinition = this.mergeTemplate(templateType, template, claimData);

                try {
                    pdfWorker = new Worker('/exa_modules/billing/static/js/workers/pdf.js');
                } catch (e) {
                    commonjs.showError('Unable to load PDF!!');
                    console.error(e);
                    return;
                }

                pdfWorker.onmessage = function (res) {
                    commonjs.hideLoading();

                    var showDialog = commonjs.showDialog;

                    if (showNestedDialog) {
                        showDialog = commonjs.showNestedDialog;
                    }

                    if(options.isOrdFac){                     
                        document.write("<iframe width='100%' height='100%' src='"+ res.data.pdfBlob+"'></iframe>");
                    }else{
                       showDialog({
                            header: self.pdfDetails[templateType].header,
                            width: '90%',
                            height: '75%',
                            url: res.data.pdfBlob
                        });
                    }
                   

                    // const anchor = document.createElement('a');
                    // document.body.appendChild(anchor);
                    // anchor.href = window.URL.createObjectURL(res.data.pdfBlob);
                    // anchor.download = 'myFileName.pdf';
                    // anchor.click();
                };

                pdfWorker.postMessage(docDefinition);
            };

            this.mergeTemplate = function (templateType, template, claimData) {
                template = template.template_content;

                var dd = null;

                if (templateType === 'direct_invoice' || templateType === 'patient_invoice') {
                    claimData = claimData[0];
                }

                try {
                    eval(template);
                } catch (err) { console.log(err); }

                if (!dd || typeof dd !== 'object') {
                    commonjs.hideLoading();
                    return commonjs.showError('Invalid data/template');
                }

                //template = mailMerge.mergeData(dd, claimData);
                template = dd;

                return template;
            }

            this.getClaimObject = function (claimIDs, templateType, options, callback) {

                options = options || {};

                $.ajax({
                    url: this.pdfDetails[templateType].api,
                    type: 'post',
                    data: {
                        claimIds: claimIDs.toString(),
                        payerType: options.payerType || '',
                        payerId: options.payerId || '',
                        sortBy: options.sortBy || '',
                        invoiceNo: options.invoiceNo,
                        flag: options.invoiceNo ? 'invoice' : 'new'
                    }, success: function (data, response) {
                        callback(null, data);
                    }, error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        callback(err);
                    }
                });
            }

            this.getTemplate = function (claimIDs, templateType, callback) {

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/printer_template',
                    type: 'post',
                    data: {
                        claimIds: claimIDs.toString(),
                        templateType: templateType
                    }, success: function (data, response) {
                        callback(null, data.length > 0 ? data[0] : {});
                    }, error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        callback(err);
                    }
                });
            };

            this.updateClaimStatus = function (claimIDs, templateType, callback) {

                $.ajax({
                    url: '/exa_modules/billing/claim_workbench/update_claim_status',
                    type: 'post',
                    data: {
                        claimIds: claimIDs.toString(),
                        templateType: templateType
                    }, success: function (data, response) {
                        $("#btnClaimsRefresh").click();
                        callback(null, data.length > 0 ? data[0] : {});
                    }, error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        callback(err);
                    }
                });
            };
        }
    });
