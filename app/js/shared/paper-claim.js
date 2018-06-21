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

            this.print = function (claimIDs) {
                var self = this;
                var win = window.open('', '_blank');

                this.getTemplate(claimIDs, function (err, template) {
                    self.getClaimObject(claimIDs, function (err, claimData) {
                        var docDefinition = self.mergeTemplate(template, claimData);
                        pdfMake.createPdf(docDefinition).open({}, win);
                        return;

                        var docDefinition = { content: 'This is an sample PDF printed with pdfMake', style: 'header', mmmm: 'sdfdsfdsf' };
                        pdfMake.createPdf(docDefinition).open({}, win);
                    });
                });
            };

            this.mergeTemplate = function (template, claimData) {
                template = template.orginal_form_template;
                claimData = claimData.data[0];

                template = { content: 'Corrected Claim', style: 'header', mergeField: 'data.date1' };
                claimData = {
                    data: {
                        date1: 'hello'
                    }
                };

                for (var key in template) {
                    if (key === 'mergeField') {
                        template.content = this.getDescendantProp(claimData, template[key]);
                        delete template[key];
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

            this.getClaimObject = function (claimIDs, callback) {

                $.ajax({
                    url: '/exa_modules/billing/claimWorkbench/claim_json',
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

            this.getTemplate = function (claimIDs, callback) {

                $.ajax({
                    url: '/exa_modules/billing/claimWorkbench/paper_claim_template',
                    data: {
                        claimIds: claimIDs
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
