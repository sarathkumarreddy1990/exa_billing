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

                this.getTemplate(claimIDs, templateType, function (err, template) {
                    self.getClaimObject(claimIDs, templateType, function (err, claimData) {
                        var docDefinition = self.mergeTemplate(templateType, template, claimData);
                        //var docDefinition = { content: 'This is an sample PDF printed with pdfMake', style: 'header', mmmm: 'sdfdsfdsf' };

                        try {
                            if (win) {
                                pdfMake.createPdf(docDefinition).open({}, win);
                            } else {
                                pdfMake.createPdf(docDefinition).getDataUrl(function (outDoc) {
                                    document.getElementById('ifrPdfPreview').src = outDoc;

                                    commonjs.showDialog({
                                        header: self.pdfDetails[templateType].header,
                                        width: '95%',
                                        height: '75%',
                                        url: outDoc
                                    });
                                });
                            }
                        } catch (err) {
                            console.log(err);
                        }
                    });
                });
            };

            this.mergeTemplate = function (templateType, template, claimData) {
                template = template.template_content;

                if (templateType === 'paper_claim_original' || templateType === 'paper_claim_full') {
                    claimData = claimData.data[0];
                }

                var dd = null;

                try {
                    eval(template);
                } catch (err) { console.log(err); }

                if (!dd || typeof dd !== 'object') {
                    return commonjs.showError('Invalid template');
                }

                template = this.mergeData(dd, claimData);

                return template;
            }

            this.mergeData = function (template, data) {
                for (var key in template) {
                    if (key === 'mergeField') {
                        template.text = this.getDescendantProp(data, template[key]);
                        //template.content = template.text;
                        //delete template[key];
                    }

                    if (typeof template[key] === 'object' && Object.keys(template[key]).length > 0) {
                        template[key] = this.mergeData(template[key], data);
                    }
                }

                return template;
            }

            this.getDescendantProp = function (obj, key) {
                try {
                    let tokenString = key.replace(/(^{|}$|^\[|\]$)/g, '');

                    // /// Checking for js script
                    // if (tokenString[0] === constants.MERGE_FIELD_KEY) {
                    //   let jsCode = tokenString.replace(/(^{|}$|^\[|\]$)/g, '');
                    //   return this.executeJsCode(jsCode, obj);
                    // }

                    let data = get(obj, tokenString);
                    return data || '';
                } catch (err) { return '' }

                return '';
            }

            this.executeJsCode = function (code, jsData) {
                try {
                    return Function('"use strict"; return ( function(jsData){' + code + '})')()(jsData);
                } catch (err) { return '' }
            }

            this.getClaimObject = function (claimIDs, templateType, callback) {

                $.ajax({
                    url: this.pdfDetails[templateType].api,
                    data: {
                        claimIds: claimIDs
                    }, success: function (data, response) {
                        callback(null, data.length > 0 ? data[0] : {});
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
