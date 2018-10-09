define([
    'jquery'
    , 'underscore'
    , 'backbone'
],
    function ($, _, Backbone) {
        var reportId = "";
        var UI = {

            initializeReportingViewModel: function (routeOptions, viewModel) {
                // Convention:
                //      reportId       - last part of route  URL
                //      reportCategory - next to last part of the route
                //      reportTitle    - defined in 'commonjs.facilityModules.reportScreens'
                //var routeParts = routeOptions.routePrefix.split('/'); //do not use
                var fragment = Backbone.history.getFragment();
                var routeParts = fragment.split('/');
                if (routeParts.length < 3) {
                    console.error('Less than 2 parts in route!');
                }
                viewModel.reportId = routeParts[routeParts.length - 1];
                viewModel.reportCategory = 'billing';
                viewModel.reportTitle = routeOptions.screen;

                return true;
            },

            setPageTitle: function (title) {
                $('#spScreenName').html(title);
            },

            clearIframe: function (elId) {
                var frame = document.getElementById(elId),
                    frameDoc = frame ? (frame.contentDocument || frame.contentWindow.document) : null;
                if (frameDoc && frameDoc.documentElement) {
                    frameDoc.removeChild(frameDoc.documentElement);
                }
            },

            generateReportUrl: function (id, category, format, params) {
                if (!(id || category || format)) {
                    return null;
                }
                var reportUrlBase = '../exa_modules/billing/reports/render/' + category + '/' + id + '.' + format;
                var reportUrlQueryString = $.param(params);
                var reportUrl = reportUrlBase + '?' + reportUrlQueryString;
                return reportUrl;
            },

            showReport: function (id, category, format, params, openInNewTab) {
                var queryStr = $.param(params);

                var iframeUrl = UI.generateReportUrl(id, category, format, params);
                if (openInNewTab) {
                    UI.clearIframe('reportFrame');
                    window.open(iframeUrl, '_blank');
                    window.onbeforeunload  = function() {
                        var opener = window.opener ? window.opener : null;
                        if(opener && opener.$ && opener.$('#divPageLoading')) {
                            opener.$('#divPageLoading').hide();
                        }
                    }
                }

                UI.clearIframe('reportFrame');
                var iFrame = $('#reportFrame');
                iFrame.attr('src', iframeUrl);

                // set the iframe height (to to height of available space) before iframe loads, otherwise PDF viewer fails to resize vertically
                iFrame.height($(window).height() - (iFrame && iFrame.offset() && iFrame.offset().top) - 10);

                $('#divPageLoading').show();
                // workaround to hide loading indicator when file is downloaded instead of being show in inframe
                if (format === 'xlsx' || format === 'csv' || format === 'xml') {
                    setTimeout(function () {
                        $('#divPageLoading').hide();
                    }, 2000);
                }

                $('#reportFrame').on("load", function () {
                    $('#divPageLoading').hide();
                    iFrame.css({ border: '1px solid #3c91f0' });
                });

                // iFrame.load(function () {
                //     //console.log('iframe loaded');
                //     $('#divPageLoading').hide();
                //     iFrame.css({ border: '1px solid #3c91f0' });
                // });

                // resize iframe when window resizes
                $(window).on('resize', function () {
                    iFrame.height($(window).height() - iFrame.offset().top - 10);
                });
            },

            // Insurance Auto Complete
            bindInsuranceAutocomplete: function (userMessage, btnAdd, ulList, isActive) {
                var self = this;
                $("#txtInsuranceName").select2({
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
                                company_id: app.companyID,
                                isActive : isActive
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
                    markup += "<td  data-id='" + repo.id + " ' title='" + repo.insurance_code + "(" + repo.insurance_name + ")'> <div>" + repo.insurance_code + "(" + repo.insurance_name +  + " " + repo.insurance_info.Address1 + " " + repo.insurance_info.Address2 + " " + repo.insurance_info.City + " " + repo.insurance_info.State +   ")" + "</div>";

                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.insurance_name;
                    }
                }

                $('#btnAddInsurance').unbind('click').click(function () {
                    if ($('#select2-txtInsuranceName-container > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Insurance to add');
                        return false;
                    }
                    if ($('#ulListInsurance li a[data-id="' + $('#txtInsuranceName').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Insurance is already selected");
                        return false;
                    }

                    var data_id = $('#txtInsuranceName').select2('data')[0].id;
                    var bind_text = $('#txtInsuranceName').select2('data')[0].insurance_name;
                    $('#ulListInsurance').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtInsuranceName').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtInsuranceName a span').html('Select User');
                });

                $('#ulListInsurance').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            bindInsuranceProviderAutocomplete: function (userMessage, btnAdd, ulList) {
                $("#txtInsuranceProviderName").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/insurance_payer_types",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 2,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "description",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },

                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select Insurance  Provider',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table class='ref-result' style='width: 100%'><tr>";
                    markup += "<td class='movie-info'><div class='movie-title'><b>" + repo.description + "</b> </div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.groupdescription_name = res.description;
                    self.code = res.code;
                    if (res && res.id) {
                        return res.description;
                    }
                }
                $('#btnAddInsuranceProvider').unbind('click').click(function () {
                    if ($('#select2-txtInsuranceProviderName-container > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Insurance provider to add');
                        return false;
                    }
                    if ($('#ulListInsuranceProvider li a[data-id="' + $('#txtInsuranceProviderName').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Insurance group is already selected");
                        return false;
                    }
                    var data_id = $('#txtInsuranceProviderName').select2('data')[0].id;
                    var bind_text = $('#txtInsuranceProviderName').select2('data')[0].description;
                    $('#ulListInsuranceProvider').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtInsuranceProviderName').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtInsuranceProviderName a span').html('Select User');
                });

                $('#ulListInsuranceProvider').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            // Referring Provider Auto Complete

            bindReferringPhysicianGroupAutoComplete: function () {
                var self = this;
                $("#txtProviderGroupName").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/provider_group_info",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "group_name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'select Study Read Physician',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup = "<table class='ref-result' style='width: 100%'><tr>";
                    markup += "<td class='movie-info'><div class='movie-title'><b>" + repo.group_name + "</b> </div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    self.group_name = res.group_name;
                    self.group_id = res.provider_group_id;
                    if (res && res.id) {
                        return res.group_name;
                    }
                }
                $('#btnAddProviderGroup').unbind('click').click(function () {
                    if ($('#select2-txtProviderGroupName-container > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Ref. Physicia to add');
                        return false;
                    }
                    if ($('#ulListProviderGroup li a[data-id="' + $('#txtProviderGroupName').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Ref. Physician is already selected");
                        return false;
                    }

                    var data_id = $('#txtProviderGroupName').select2('data')[0].id;
                    var bind_text = $('#txtProviderGroupName').select2('data')[0].group_name;
                    $('#ulListProviderGroup').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtProviderGroupName').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtProviderGroupName a span').html('Select Ref. Physician');
                });

                $('#ulListProviderGroup').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });

            },


            bindBillingProvider: function () {
                var billingProviderList = app.billing_providers,
                    ddlBillingProvider = $('#ddlBillingProvider');
                ddlBillingProvider.empty();
                if (billingProviderList && billingProviderList.length > 0) {
                    for (var b = 0; b < billingProviderList.length; b++) {
                        ddlBillingProvider.append($('<option/>', {
                            value: billingProviderList[b].id,
                            text: billingProviderList[b].full_name
                        }));
                    }
                }
                // For Multi Select drop down
                $('#ddlBillingProvider').multiselect({
                    maxHeight: 200,
                    buttonWidth: '250px',
                    enableFiltering: true,
                    includeSelectAllOption: true,
                    enableCaseInsensitiveFiltering: true
                });
            },

            // Users Auto Complete

            listUsersAutoComplete: function (userMessage, btnAdd, ulList) {
                var self = this;
                $("#txtUsers").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/getUsers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "user_name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select users',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.user_name;
                    }
                    var markup = "<table><tr>";
                    markup += "<td  data-id='" + repo.id + " ' title='" + repo.user_name + "(" + repo.user_name + ")'> <div>" + repo.id + "(" + repo.user_name + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.user_name;
                    }
                }

                $('#btnAddUsers').unbind('click').click(function () {
                    if ($('#select2-txtUsers-container > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Users to add');
                        return false;
                    }
                    if ($('#ulListUsers li a[data-id="' + $('#txtUsers').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("User is already selected");
                        return false;
                    }

                    var data_id = $('#txtUsers').select2('data')[0].id;
                    var bind_text = $('#txtUsers').select2('data')[0].user_name;
                    $('#ulListUsers').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtUsers').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtUsers a span').html('Select User');
                });

                $('#ulListUsers').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });



            },
            listUsersRoleAutoComplete: function (userRoleMessage, btnAdd, ulList) {
                var self = this;
                $("#txtUsersRole").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/getUserRoles",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "role_name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select users Role',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.role_name;
                    }
                    var markup = "<table><tr>";
                    markup += "<td  data-id='" + repo.id + " ' title='" + repo.role_name + "(" + repo.role_name + ")'> <div>" + repo.id + "(" + repo.role_name + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.role_name;
                    }
                }

                $('#btnAddUsersRole').unbind('click').click(function () {
                    if ($('#select2-txtUsersRole-container > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Users Role to add');
                        return false;
                    }
                    if ($('#ulListUsersRole li a[data-id="' + $('#txtUsersRole').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("User Role is already selected");
                        return false;
                    }

                    var data_id = $('#txtUsersRole').select2('data')[0].id;
                    var bind_text = $('#txtUsersRole').select2('data')[0].role_name;
                    $('#ulListUsersRole').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtUsersRole').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtUsersRole a span').html('Select User Role');
                });

                $('#ulListUsersRole').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });



            },

            // Common Click Events
            setEvents: function (fieldId, fieldName, ulList) {
                $('#' + fieldId).unbind('click').click(function () {
                    var uListIds = $('#' + ulList).data('id') || [];

                    if ($('#s2id_' + fieldName + '  > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one  to add');
                        return false;
                    }

                    if ($('#' + ulList + 'li a[data-id="' + $('#' + fieldName).select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Already selected");
                        return false;
                    }
                    var data_id = $('#' + fieldName).select2('data')[0].id;
                    var bind_text = $('#' + fieldName).select2('data')[0].text;
                    $('#' + ulList).append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#' + fieldName).select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#' + fieldName + 'a span').html('Select Any One');
                });

                $('#' + ulList).delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                    return;
                });
            },

            bindPatient: function (fieldID, userMessage, btnAdd, ulList) {
                var self = this;
                var self = this;
                $('#txtPatient a span').html('Select Patient');
                $("#txtPatient").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/patients",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {

                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "full_name",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select Patient',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.full_name;
                    }
                    var markup = "<table><tr>";
                    markup += "<td data-id='" + repo.id + " ' title='" + repo.full_name + "(" + repo.account_no + ")'> <div>" + repo.full_name + "(" + repo.account_no + ")" + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.full_name;
                    }
                }

                $('#btnAddPatient').unbind('click').click(function () {
                    if ($('#s2id_txtPatient > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one patient to add');
                        return false;
                    }
                    if ($('#ulListPatients li a[data-id="' + $('#txtPatient').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Patient is already selected");
                        return false;
                    }
                    var data_id = $('#txtPatient').select2('data')[0].id;
                    var bind_text = $('#txtPatient').select2('data')[0].full_name;
                    $('#ulListPatients').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtPatient').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtPatient a span').html('Select User');
                });

                $('#ulListPatients').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            bindReferringProviderAutoComplete: function (txtprovider, btnProvider, ulListProvider) {
                $("#" + txtprovider).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/providers",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                provider_type: 'RF',
                                pageSize: 10,
                                sortField: "p.last_name",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'self.usermessage.selectStudyReadPhysician',
                    escapeMarkup: function (markup) { return markup; },
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.text;
                    }
                    var markup1 = "<table class='ref-result' style='width: 100%'><tr>";
                    markup1 += "<td data-id='" + repo.provider_id + " ' title='" + repo.full_name + "'> <div>" + repo.full_name + "</div>";
                    markup1 += "</td></tr></table>";
                    return markup1;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.full_name;
                    }
                }


                // txtprovider, btnProvider, ulListProvider
                $('#' + btnProvider).unbind('click').click(function () {
                    if ($('#s2id_' + txtprovider + ' > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one Provider to add');
                        return false;
                    }
                    if ($('#' + ulListProvider + ' li a[data-id="' + $('#' + txtprovider).select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("Provider is already selected");
                        return false;
                    }
                    var data_id = $('#' + txtprovider).select2('data')[0].provider_id;
                    var bind_text = $('#' + txtprovider).select2('data')[0].full_name;
                    $('#' + ulListProvider).append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#' + txtprovider).select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#' + txtprovider + 'a span').html('Select Provider');
                });

                $('#' + ulListProvider).delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            bindCPTCodeInformations: function (txtCPTCodeInformation, btnCPTCode, ulListCPTCode) {
                $("#" + txtCPTCodeInformation).select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "trim(display_description)",
                                sortOrder: "asc",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'select CPT Code',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });
                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.display_description;
                    }
                    var markup1 = "<table><tr>";
                    if (repo.display_code != '')
                        markup1 += "<td title='" + repo.display_code + "(" + repo.display_description + ")" + "'><div>" + repo.display_code + "(" + repo.display_description + ")" + "</div>";
                    else
                        markup += "<td title='" + repo.display_code + repo.display_description + "'><div>" + repo.display_code + repo.display_description + "</div>";
                    markup1 += "</td></tr></table>"
                    return markup1;
                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.display_description
                    }
                }
                //txtCPTCodeInformation, btnCPTCode, ulListCPTCode
                $('#' + btnCPTCode).unbind('click').click(function () {
                    if ($('#s2id_' + txtCPTCodeInformation + ' > a.select2-default').length > 0) {
                        commonjs.showWarning('Please select one CPT to add');
                        return false;
                    }
                    if ($('#' + ulListCPTCode + ' li a[data-id="' + $('#' + txtCPTCodeInformation).select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("CPT is already selected");
                        return false;
                    }
                    var data_id = $('#' + txtCPTCodeInformation).select2('data')[0].id;
                    var bind_text = $('#' + txtCPTCodeInformation).select2('data')[0].display_description;
                    var bind_code = $('#' + txtCPTCodeInformation).select2('data')[0].display_code;
                    $('#' + ulListCPTCode).append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '('+ bind_code + ')' +'</span><a class="remove" data-id="' + $('#' + txtCPTCodeInformation).select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#' + txtCPTCodeInformation + 'a span').html('Select CPT');
                });

                $('#' + ulListCPTCode).delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            hideShowBox: function (ddl) {
                if ($('#' + ddl + 'Option').val() !== 'S') {
                    $('#' + ddl + 'Add').hide();
                    $('#' + ddl + 'Box').hide();
                }
                else {
                    $('#' + ddl + 'Add').show();
                    $('#' + ddl + 'Box').show();
                }
            }
        };

        return UI;

    });
