define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/setup/validation.html',
    'collections/setup/validations',
    'models/setup/validations',
    'models/pager'
]
    , function ($, _, Backbone, Validation, ValidationCollections, ValidationModel, Pager) {
        var ValidationView = Backbone.View.extend({
            validationTemplate: _.template(Validation),
            validateInfo: null,
            model: null,
            pager: null,
            events: {
            },

            initialize: function (options) {
                var self = this;
                this.options = options;
                this.model = new ValidationModel();
                this.pager = new Pager();
                this.validateInfo = new ValidationCollections();
            },

            render: function () {
                var self = this;
                $(this.el).html(this.validationTemplate());
                commonjs.initializeScreen({header: {screen: 'Validate', ext: 'validate'}, buttons: [
                    {value: 'Save', type: 'submit', class: 'btn btn-primary', i18n: 'shared.buttons.save', clickEvent: function () {
                        self.saveValidateInfo();
                    }}
                ]});
                this.model.fetch({
                    success: function (model, response) {
                        var eJson = self.getJson(response[0].edi_validation);
                        var iJson = self.getJson(response[0].invoice_validation);
                        var pJson = self.getJson(response[0].patient_validation);
                        self.getHtml(eJson, $('#divElectricValidation'), 'ele');
                        self.getHtml(iJson, $('#divInvoiceValidation'), 'inv');
                        self.getHtml(pJson, $('#divPatientValidation'), 'pat');
                        self.id = response[0].id;
                        $("#validateElectronic").addClass("activeValTag").siblings().removeClass("activeValTag");
                        $('#divElectricValidation').show();
                        $('#divInvoiceValidation').hide();
                        $('#divPatientValidation').hide();
                        commonjs.processPostRender();
                    }
                });

                $('#validateElectronic').click(function () {
                    $(this).addClass("activeValTag").siblings().removeClass("activeValTag");
                    $('#divElectricValidation').show();
                    $('#divInvoiceValidation').hide();
                    $('#divPatientValidation').hide();
                });
                $('#validateInvoice').click(function () {
                    $(this).addClass("activeValTag").siblings().removeClass("activeValTag");
                    $('#divElectricValidation').hide();
                    $('#divInvoiceValidation').show();
                    $('#divPatientValidation').hide();
                });
                $('#validatePatient').click(function () {
                    $(this).addClass("activeValTag").siblings().removeClass("activeValTag")
                    $('#divElectricValidation').hide();
                    $('#divInvoiceValidation').hide();
                    $('#divPatientValidation').show();
                });
            },

            showAll: function () {
                this.render();
            },

            saveValidateInfo: function () {
                var ediInfo = $('#divElectricValidation').children(":input");
                var invoiceInfo = $('#divInvoiceValidation').children(":input");
                var patientInfo = $('#divPatientValidation').children(":input");
                this.model.set({
                    "id": this.id,
                    "companyId": app.companyID,
                    "ediValidation": this.parsingtoJson(ediInfo),
                    "invoiceValidation": this.parsingtoJson(invoiceInfo),
                    "patientValidation": this.parsingtoJson(patientInfo)
                });
                this.model.save({

                }, {
                    success: function (model, response) {
                        if (response) {
                            location.href = "#setup/validations/all";
                        }
                    },
                    error: function (model, response) {
                        commonjs.handleXhrError(model, response);
                    }
                });
            },

            getJson: function (obj) {
                var group = {
                    billingGrp: [],
                    claimGrp: [],
                    insuranceGrp: [],
                    patientGrp: [],
                    readingGrp: [],
                    refferingGrp: [],
                    claimServiceGrp: [],
                    serviceGrp: [],
                    subscriberGrp: [],
                    payerGrp: []
                };
                for (var i = 0; i < obj.length; i++) {
                    if (obj[i].field.indexOf("billing") > -1) {
                        group.billingGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("claim") > -1) {
                        group.claimGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("insurance") > -1) {
                        group.insuranceGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("patient") > -1) {
                        group.patientGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("reading") > -1) {
                        group.readingGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("ref") > -1) {
                        group.refferingGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("line_dig1") > -1) {
                        group.claimServiceGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("service") > -1) {
                        group.serviceGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("subscriber") > -1) {
                        group.subscriberGrp.push(obj[i]);
                    } else if (obj[i].field.indexOf("payer") > -1) {
                        group.payerGrp.push(obj[i]);
                    }
                }
                return group;
            },

            getHtml: function (obj, tag, type) {
                var self = this;
                for (group in obj) {
                    if (obj[group].length) {
                        var html = "";
                        html += " <input type='checkbox' id =" + (type + group) + "  >";
                        html += " <b><label class='control-label' for=" + (type + group) + " i18n=setup.validation." + group + "></label></b>  <br>"
                        tag.append(html);
                        $("#" + (type + group)).click(function (e) {
                            var status = $(e.currentTarget).prop('checked');
                            for (var i = 0; i < obj[e.currentTarget.id.slice(3)].length; i++) {
                                $("#" + (type + obj[e.currentTarget.id.slice(3)][i].field)).prop('checked', status);
                            }
                        });
                        obj[group].memCount = 0;
                        for (var i = 0; i < obj[group].length; i++) {
                            html = "";
                            html += " <input type='checkbox' id =" + (type + obj[group][i].field) + "   style='margin-left:50px' >";
                            html += " <label class='control-label' for=" + (type + obj[group][i].field) + " i18n=setup.validation." + obj[group][i].field + "></label>  <br>"
                            if (obj[group][i].enabled)  obj[group].memCount++;
                            tag.append(html);
                            $("#" + type + obj[group][i].field).prop('checked', obj[group][i].enabled ? true : false);
                            $("#" + (type + obj[group][i].field)).click(function (e) {
                                var status = $(e.currentTarget).prop('checked');
                                var group = self.findGroup(e.currentTarget.id)
                                status ? obj[group].memCount++ : obj[group].memCount--;
                                $("#" + type + group).prop('checked', obj[group].length == obj[group].memCount ? true : false);
                            });
                        }
                        if (obj[group].length == obj[group].memCount)  $("#" + type + group).prop('checked', true);
                    }

                }
            },

            parsingtoJson: function (obj) {
                var json = [];
                for (var i = 0; i < obj.length; i++) {
                    if (obj[i].getAttribute("id").indexOf("Grp") < 0) {
                        var property = {
                            "field": obj[i].getAttribute("id").slice(3),
                            "enabled": obj[i].checked
                        }
                        json.push(property);
                    }
                }
                return json;
            },

            findGroup: function (id) {
                if (id.indexOf("billing") > -1) {
                    return "billingGrp";
                } else if (id.indexOf("claim") > -1) {
                    return "claimGrp";
                } else if (id.indexOf("insurance") > -1) {
                    return "insuranceGrp";
                } else if (id.indexOf("patient") > -1) {
                    return "patientGrp";
                } else if (id.indexOf("reading") > -1) {
                    return "readingGrp";
                } else if (id.indexOf("ref") > -1) {
                    return "refferingGrp";
                } else if (id.indexOf("line_dig1") > -1) {
                    return "claimServiceGrp";
                } else if (id.indexOf("service") > -1) {
                    return "serviceGrp";
                } else if (id.indexOf("subscriber") > -1) {
                    return "subscriberGrp";
                } else if (id.indexOf("payer") > -1) {
                    return "payerGrp";
                }
            }

        });


        return ValidationView;
    });


