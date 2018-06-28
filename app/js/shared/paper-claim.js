define([
    'jquery',
    '_get',
    'backbone',
], function (
    $,
    _get,
    Backbone
) {
        return function () {

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

            this.print = function (templateType, claimIDs) {
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
                    self.getClaimObject(claimIDs, templateType, function (err, claimData) {

                        var docDefinition = self.mergeTemplate(templateType, template, claimData);
                        //var docDefinition = { content: 'This is an sample PDF printed with pdfMake', style: 'header', mmmm: 'sdfdsfdsf' };

                        var pdfWorker;

                        try {
                            pdfWorker = new Worker('/exa_modules/billing/static/js/workers/pdf.js');
                        } catch (e) {
                            console.error(e);
                            return;
                        }

                        pdfWorker.onmessage = function (res) {
                            console.log('Response received from worker');

                            commonjs.hideLoading();
                            //document.getElementById('ifrPdfPreview').src = outDoc;

                            commonjs.showDialog({
                                header: self.pdfDetails[templateType].header,
                                width: '95%',
                                height: '80%',
                                url: res.data.pdfBlob
                            });

                            // const anchor = document.createElement('a');
                            // document.body.appendChild(anchor);
                            // anchor.href = window.URL.createObjectURL(res.data.pdfBlob);
                            // anchor.download = 'myFileName.pdf';
                            // anchor.click();
                        };

                        pdfWorker.postMessage(docDefinition);
                        return;
                      

                        // commonjs.hideLoading();

                        // try {
                        //     if (win) {
                        //         pdfMake.createPdf(docDefinition).open({}, win);
                        //     } else {
                        //         pdfMake.createPdf(docDefinition).getDataUrl(function (outDoc) {
                        //             document.getElementById('ifrPdfPreview').src = outDoc;

                        //             commonjs.showDialog({
                        //                 header: self.pdfDetails[templateType].header,
                        //                 width: '95%',
                        //                 height: '80%',
                        //                 url: outDoc
                        //             });
                        //         });
                        //     }
                        // } catch (err) {
                        //     console.log(err);
                        // }
                    });
                });
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

            this.getClaimObject = function (claimIDs, templateType, callback) {

                $.ajax({
                    url: this.pdfDetails[templateType].api,
                    data: {
                        claimIds: claimIDs
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
                    data: {
                        claimIds: claimIDs,
                        templateType: templateType
                    }, success: function (data, response) {
                        callback(null, data.length > 0 ? data[0] : {});
                    }, error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                        callback(err);
                    }
                });
            };
        }
    });
