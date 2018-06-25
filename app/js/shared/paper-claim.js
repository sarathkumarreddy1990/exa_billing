define([
    'jquery',
    '_get',
    'backbone',
    'pdfmake',
    'pdfmake-fonts'
], function (
    $,
    _get,
    Backbone,
    pdfmake,
    pdfmakeFonts
) {
        return function () {

            this.print = function (templateType, claimIDs) {
                var self = this;
                var win = window.open('', '_blank');

                this.getTemplate(claimIDs, templateType, function (err, template) {
                    self.getClaimObject(claimIDs, templateType, function (err, claimData) {
                        var docDefinition = self.mergeTemplate(template, claimData);

                        pdfMake.createPdf(docDefinition).open({}, win);
                        return;

                        var docDefinition = { content: 'This is an sample PDF printed with pdfMake', style: 'header', mmmm: 'sdfdsfdsf' };
                        pdfMake.createPdf(docDefinition).open({}, win);
                    });
                });
            };

            this.mergeTemplate = function (template, claimData) {
                template = template.template_content;
                claimData = claimData.data[0];

                // template = { content: 'Corrected Claim', style: 'header', mergeField: 'data.date1' };
                // claimData = {
                //     data: {
                //         date1: 'hello'
                //     }
                // };

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

                var apis = {
                    'paper_claim_original': '/exa_modules/billing/claim_workbench/claim_json',
                    'paper_claim_full': '/exa_modules/billing/claim_workbench/claim_json',
                    'direct_invoice': '/exa_modules/billing/claim_workbench/invoice_json',
                    'patient_invoice': '/exa_modules/billing/claim_workbench/patient_invoice_json',
                };

                if (!apis[templateType]) {
                    return callback(new Error('Invalid template type'));
                }

                $.ajax({
                    url: apis[templateType],
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
