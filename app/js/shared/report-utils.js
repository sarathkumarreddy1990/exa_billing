define([
    'jquery'
    , 'underscore'
    , 'backbone'
    , 'sweetalert2'
],
    function ($, _, Backbone, swal2) {
        var reportId = "";
        var UI = {
            getReportSetting: function (viewModel, report_id, code) {
                $.ajax({
                    url: '/exa_modules/billing/reportSettingsRouter/getReportSetting',
                    type: 'GET',
                    async: false,
                    data: {
                        report_id: report_id,
                        code: code
                    },
                    success: function (data, response) {
                        if (data[0].value !== undefined) {
                            viewModel[code] = data[0].value;
                            viewModel.country_alpha_3_code = data[0].country_alpha_3_code;
                        }
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

            bindStudyStatus: function () {
                $.ajax({
                    url: '/exa_modules/billing/autoCompleteRouter/getStudyStatus',
                    type: 'GET',
                    async: false,
                    success: function (data, response) {
                        var statusList = data && data.length > 0 ? data : [];
                        var $ddlStudyStatus = $('#ddlStudyStatus');

                        $ddlStudyStatus.empty();
                        for (var b = 0; b < statusList.length; b++) {
                            $ddlStudyStatus.append($('<option/>', {
                                value: statusList[b].status_code,
                                text: statusList[b].status_desc
                            }));
                        }

                        // For Multi Select drop down
                        $ddlStudyStatus.multiselect({
                            maxHeight: 200,
                            buttonWidth: '250px',
                            enableFiltering: true,
                            includeSelectAllOption: true,
                            enableCaseInsensitiveFiltering: true
                        });
                    },
                    error: function (err, response) {
                        commonjs.handleXhrError(err, response);
                    }
                });
            },

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

            clearIframe: function(elId) {
                var frame = document.getElementById(elId);
                var frameDoc = frame ? (frame.contentDocument || frame.contentWindow) : null;
                if (frameDoc && frameDoc.documentElement) {
                    frameDoc.removeChild(frameDoc.documentElement);
                }
            },

            generateReport: function(id, category, format, params) {
                var isHtml = format === 'html';

                swal2.fire({
                    type: 'success',
                    title: i18n.get("report.home.reportCreated"),
                    html:  isHtml ? i18n.get("report.home.displayAutomatically") : i18n.get("report.home.reportProcess")
                });

                // fire request for report
                return $.ajax({
                    url: this.generateReportUrl(id, category, format),
                    type: "POST",
                    data: params
                })
                    .done(function(data) {
                        // TODO: MAke sure if on the same page, we do the UI.showReport call for html, else just show a toast notification
                        if (format === 'html') {
                            var options = {
                                'id': data.result.id,
                                'fileExtension': 'html'
                            };

                            swal2.fire({
                                type: 'success',
                                title: i18n.get("report.home.reportIsReady"),
                                showConfirmButton: false,
                                timer: 2000
                            }).then(function() { UI.showReport(options); });
                        }
                    })
                    .fail(function(err) {
                        commonjs.handleXhrError(err);
                    })
            },

            generateReportUrl: function (id, category, format, params) {
                if (!(id || category || format)) {
                    return null;
                }

                var reportUrl = '../exa_modules/billing/reports/render/' + category + '/' + id + '.' + format;

                if (params) {
                    reportUrl += '?' + $.param(params);
                }

                return reportUrl;
            },

            showReport: function (options) {
                var iframeUrl = '';

                if (options.generateUrl) {
                    iframeUrl = UI.generateReportUrl(options.id, options.category, options.format, options.params);
                } else {
                    iframeUrl = '/report?' + $.param(options);
                }

                if (options.openInNewTab) {
                    window.open(iframeUrl, '_blank');
                    return;
                }

                UI.clearIframe('reportFrame');
                var iFrame = $('#reportFrame');
                iFrame.attr('src', iframeUrl);

                // set the iframe height (to to height of available space) before iframe loads, otherwise PDF viewer fails to resize vertically
                iFrame.height($(window).height() - (iFrame && iFrame.offset() && iFrame.offset().top) - 10);

                $('#divPageLoading').show();
                // workaround to hide loading indicator when file is downloaded instead of being show in inframe
                setTimeout(function () {
                    $('#divPageLoading').hide();
                }, 2000);

                // resize iframe when window resizes
                $(window).resize(function () {
                    iFrame.height($(window).height() - iFrame.offset().top - 10);
                });
            },

            // Insurance Auto Complete
            bindInsuranceAutocomplete: function (userMessage, btnAdd, ulList, radInsActiveFlag) {
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
                                isInactive : radInsActiveFlag
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

                $('#btnAddInsurance').off('click').on('click', function () {
                    var insurance = $('#txtInsuranceName');
                    var insuranceData = insurance.select2('data')[0];
                    var ulListInsurance = $('#ulListInsurance');

                    if (!insuranceData) {
                        return commonjs.showWarning("messages.warning.shared.selectOneInsurance");
                    }

                    var insuranceId = insuranceData.id;

                    if (ulListInsurance.find('li a[data-id="' + insuranceId + '"]').length) {
                        return commonjs.showWarning("messages.warning.shared.insuranceExist");
                    }

                    ulListInsurance.append('<li id="' + insuranceId + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + insuranceData.insurance_name + '</span><a class="remove" data-id="' + insuranceId + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>');
                    insurance.html('');
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
                                page: params.page || 1,
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
                $('#btnAddInsuranceProvider').off('click').on('click', function () {
                    var insuranceProvider = $('#txtInsuranceProviderName');
                    var insuranceProviderData = insuranceProvider.select2('data')[0];
                    var ulListInsuranceProvider = $('#ulListInsuranceProvider');

                    if (!insuranceProviderData) {
                        return commonjs.showWarning("messages.warning.shared.selectOneInsuranceGroup");
                    }

                    var insuranceProviderId = insuranceProviderData.id;

                    if (ulListInsuranceProvider.find('li a[data-id="' + insuranceProviderId + '"]').length) {
                        return commonjs.showWarning("messages.warning.shared.insuranceGroupExist");
                    }

                    ulListInsuranceProvider.append('<li id="' + insuranceProviderId + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + insuranceProviderData.description + '</span><a class="remove" data-id="' + insuranceProviderId + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>');
                    insuranceProvider.html('');
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
                                companyId: app.companyID,
                                groupType: 'PG'
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


            // Adjustment Code Auto Complete

            adjustmentCodeAutoComplete: function (adjustmentMsg, btnAdd, ulList) {
                var self = this;

                $("#txtAdjustmentCode").select2({
                    ajax: {
                        url: "/exa_modules/billing/autoCompleteRouter/adjustment_code",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                page: params.page || 1,
                                q: params.term || '',
                                pageSize: 10,
                                sortField: "code",
                                sortOrder: "ASC",
                                company_id: app.companyID
                            };
                        },
                        processResults: function (data, params) {
                            return commonjs.getTotalRecords(data, params);
                        },
                        cache: true
                    },
                    placeholder: 'Select Adj. Code',
                    escapeMarkup: function (markup) { return markup; }, // let our custom formatter work
                    minimumInputLength: 0,
                    templateResult: formatRepo,
                    templateSelection: formatRepoSelection
                });


                function formatRepo(repo) {
                    if (repo.loading) {
                        return repo.code;
                    }
                    var markup = "<table><tr>";
                    markup += "<td  data-id='" + repo.id + " ' title='" + repo.code + "(" + repo.code + ")'> <div>" + repo.description + '(' + repo.code +')' + "</div>";
                    markup += "</td></tr></table>";
                    return markup;

                }
                function formatRepoSelection(res) {
                    if (res && res.id) {
                        return res.description;
                    }
                }

                $('#btnAddAdjustmentCode').off('click').click(function () {
                    if ($('#ulListAdjustmentCode li a[data-id="' + $('#txtAdjustmentCode').select2('data')[0].id + '"]').length) {
                        commonjs.showWarning("report.reportFilter.adjustmentCodeSelected");
                        return false;
                    }

                    var data_id = $('#txtAdjustmentCode').select2('data')[0].id;
                    var bind_text = $('#txtAdjustmentCode').select2('data')[0].description;
                    $('#ulListAdjustmentCode').append('<li id="' + data_id + '"><span style="background:#3c91f0; color:white; border:1px solid black">' + bind_text + '</span><a class="remove" data-id="' + $('#txtAdjustmentCode').select2('data')[0].id + '"><span class="icon-ic-close" style="margin-left:8px;"></span></a></li>')
                    $('#txtAdjustmentCode a span').html("report.reportFilter.adjustmentCode");
                });

                $('#ulListAdjustmentCode').delegate('a.remove', 'click', function () {
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
