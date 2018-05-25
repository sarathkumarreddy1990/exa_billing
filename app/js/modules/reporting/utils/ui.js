define([
    'jquery'
    , 'underscore'
    , 'backbone'
],
    function ($, _, Backbone) {

        const UI = {

            initializeReportingViewModel: function(routeOptions, viewModel) {
                // Convention:
                //      reportId       - last part of route  URL
                //      reportCategory - next to last part of the route
                //      reportTitle    - defined in 'commonjs.facilityModules.reportScreens'
                //var routeParts = routeOptions.routePrefix.split('/'); //do not use
                const fragment = Backbone.history.getFragment();
                const routeParts = fragment.split('/');
                if (routeParts.length < 3) {
                    console.error('Less than 3 parts in route!');
                }
                viewModel.reportId = routeParts[routeParts.length - 1];
                viewModel.reportCategory = routeParts[routeParts.length - 2];
                viewModel.reportTitle = routeOptions.screen;

                return true;
            },

            setPageTitle: function(title) {
                $('#spScreenName').html(title);
            },

            clearIframe: function(elId) {
                const frame = document.getElementById(elId),
                    frameDoc = frame ? (frame.contentDocument || frame.contentWindow.document) : null;
                if (frameDoc && frameDoc.documentElement) {
                    //console.log('clearing iframe: ' + elId);
                    frameDoc.removeChild(frameDoc.documentElement);
                }
            },

            generateReportUrl: function(id, category, format, params) {
                if (!(id || category || foramt)) {
                    console.log('Report URL cannot be generated!');
                    return null;
                }
                const reportUrlBase = '../reports/render/' + category + '/' + id + '.' + format;
                const reportUrlQueryString = $.param(params);
                const reportUrl = reportUrlBase + '?' + reportUrlQueryString;
                //console.log('reportUrl: ', reportUrl);
                return reportUrl;
            },

            showReport: function(id, category, format, params, openInNewTab) {
                const queryStr = $.param(params);
                const iframeUrl = UI.generateReportUrl(id, category, format, params);

                if (openInNewTab) {
                    console.log('new window', id, iframeUrl);
                    window.open(iframeUrl, '_blank');
                    return;
                }

                UI.clearIframe('reportFrame');
                const iFrame = $('#reportFrame');
                iFrame.attr('src', iframeUrl);

                // set the iframe height (to to height of available space) before iframe loads, otherwise PDF viewer fails to resize vertically
                iFrame.height($(window).height() - iFrame.offset().top - 10);

                $('#divPageLoading').show();
                // workaround to hide loading indicator when file is downloaded instead of being show in inframe
                if (format === 'xlsx' || format === 'csv' || format === 'xml') {
                    setTimeout(function () {
                        $('#divPageLoading').hide();
                    }, 2000);
                }

                iFrame.load(function () {
                    //console.log('iframe loaded');
                    $('#divPageLoading').hide();
                    iFrame.css({ border: '1px solid #3c91f0' });
                });

                // resize iframe when window resizes
                $(window).resize(function () {
                    iFrame.height($(window).height() - iFrame.offset().top - 10);
                });
            },

            bindStudyStatusesToMultiselect: function(elId, facilityIds, callback) {
                commonjs.showLoading();
                $.ajax({
                    url: '/getStudyStatus1',
                    type: 'GET',
                    data: {
                        flag: 'study',
                        facilities: facilityIds.length > 0 ? facilityIds : 0
                    }
                })
                .done(function (data, textStatus, jqXHR) {
                    //data.result is array of objects [{}, {}}]
                    if (data && data.result && data.result.length > 0) {
                        ddlEl = $('' + elId + '');

                        // remove all
                        ddlEl.find('option').remove();
                        // rebuild selections
                        $.each(data.result, function (key, value) {
                            ddlEl.append($('<option></option>')
                                .attr('value', value.status_code /*key*/)
                                .text(value.status_desc /*value*/));
                        });
                        // preselect relevant statuses
                        //ddlEl.val(['APP', 'DIC', 'RE']).change();
                        callback(null, ddlEl); // use the callback to pre-select statuses
                    } else {
                        console.log('no results!');
                        callback(new Error('no results'), null);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    commonjs.handleXhrError(jqXHR, textStatus);
                    callback(errorThrown, null);
                })
                .always(function () {
                    commonjs.hideLoading();
                });
            },

            bindStatusesToMultiselect: function(elId, facilityIds, callback, allFacilities) {
                commonjs.showLoading();
                $.ajax({
                    url: '/getStudyAndOrderStatuses',
                    type: 'GET',
                    data: {
                        facilities: facilityIds && facilityIds.length > 0 ? facilityIds : 0,
                        allFacilities: allFacilities
                    }
                })
                .done(function (data, textStatus, jqXHR) {
                    //data.result is array of objects [{}, {}}]
                    if (data && data.result && data.result.length > 0) {
                        ddlEl = $('' + elId + '');

                        // remove all
                        ddlEl.find('option').remove();
                        // rebuild selections
                        $.each(data.result, function (key, value) {
                            ddlEl.append($('<option></option>')
                                .attr('value', value.status_code /*key*/)
                                .text(value.status_desc /*value*/));
                        });
                        // preselect relevant statuses
                        //ddlEl.val(['APP', 'DIC', 'RE']).change();
                        callback(null, ddlEl); // use the callback to pre-select statuses
                    } else {
                        console.log('no results!');
                        callback(new Error('no results'), null);
                    }
                })
                .fail(function (jqXHR, textStatus, errorThrown) {
                    commonjs.handleXhrError(jqXHR, textStatus);
                    callback(errorThrown, null);
                })
                .always(function () {
                    commonjs.hideLoading();
                });
            },

            bindInsuranceAutocomplete: function (fieldID, fieldName, userMessage, facilityIDs, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID: "#" + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: "/insuranceProvidersAutoComplete",
                    data: function (term, page) {
                        return {
                            hide_inactive: true,
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            from: 'autocomplete',
                            sortField: "insurance_providers.insurance_code",
                            facility: commonjs.orderFacility,
                            facilities: facilityIDs,
                            sortOrder: "asc"
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var insurance_info = commonjs.hstoreParse(res.insurance_info);
                        var param = {
                            code: res.insurance_code ? res.insurance_code  : ' ',
                            name: res.insurance_name ? res.insurance_name : ' ',
                            address: insurance_info.Address1 ? insurance_info.Address1 :' ',
                            city: insurance_info.City ? insurance_info.City : ' ',
                            state: insurance_info.State ? insurance_info.State : ' ',
                            zip: insurance_info.ZipCode ? insurance_info.ZipCode : ' '
                        }
                        return commonjs.formatInsuranceACResult(param);
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('insuranceIdAdded',~~res.id);
                        $('#' + btnAdd).data('insuranceNameAdded',res.insurance_name);
                        return res.insurance_name;
                    }
                });
                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }

                    // Check to see if this insurance already exists in the box
                    var insuranceIdsList = $('#' + ulList).data('insuranceIds') || [],
                        insuranceIdAdded = $(this).data('insuranceIdAdded');
                    insuranceNameAdded = $(this).data('insuranceNameAdded');

                    // Check to see if insurance already exists in the box
                    if (_.indexOf(insuranceIdsList,insuranceIdAdded) !== -1) {
                        commonjs.showError("Insurnace Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + insuranceNameAdded + '</span><a class="remove" data-id="' + insuranceIdAdded + '" id="' + insuranceIdAdded + '" data-value="' + insuranceNameAdded + '"><span class="icon-ic-close"></span></a></li>');
                        insuranceIdsList.push(~~insuranceIdAdded);
                        $('#' + ulList).data('insuranceIds',insuranceIdsList);
                    }
                });
                $('#' + ulList).on('click','a.remove',function() {
                    var insuranceIdsList = $('#' + ulList).data('insuranceIds') || [],
                        insuranceIdRemoved = $(this).attr('data-id');
                    insuranceIdsList = _.without(insuranceIdsList,~~insuranceIdRemoved);
                    $('#' + ulList).data('insuranceIds',insuranceIdsList);
                    $(this).closest('li').remove();
                    return;
                });
                $('#' + ulList).data('insuranceIds',[]);
            },

            bindCptAutocomplete: function (fieldID, fieldName, userMessage, facilityIDs, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID: '#' + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: '/cptsAutoComplete',
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: "trim(display_description)",
                            sortOrder: "ASC",
                            from: 'report_filter',
                            modalities: 0,
                            facilities: facilityIDs

                        };
                    },
                    results: function (data, page) {
                        var more = data && data.result && data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },

                    formatID: function (obj) {
                        if (obj.id) {
                            return obj.id;
                        }
                    },

                    formatResult: function (res) {
                        return commonjs.formatACResult(res.display_code, res.display_description, res.is_active, res.linked_cpt_codes ? res.linked_cpt_codes.toString() : "", true);
                    },

                    formatSelection: function (res) {
                        $('#' + btnAdd).data('cptIdAdded',~~res.id);
                        $('#' + btnAdd).data('cptNameAdded',res.display_code);
                        return res.display_code;
                    }
                });
                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }

                    // Check to see if this CPT already exists in the box
                    var cptIdsList = $('#' + ulList).data('cptIds') || [],
                        cptIdAdded = $(this).data('cptIdAdded');
                    cptNameAdded = $(this).data('cptNameAdded');

                    // Check to see if CPT already exists in the box
                    if (_.indexOf(cptIdsList,cptIdAdded) !== -1) {
                        commonjs.showError("CPT Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + cptNameAdded + '</span><a class="remove" data-id="' + cptIdAdded + '" id="' + cptIdAdded + '" data-value="' + cptNameAdded + '"><span class="icon-ic-close"></span></a></li>');
                        cptIdsList.push(~~cptIdAdded);
                        $('#' + ulList).data('cptIds',cptIdsList);
                    }
                });
                $('#' + ulList).on('click','a.remove',function() {
                    var cptIdsList = $('#' + ulList).data('cptIds') || [],
                        cptIdRemoved = $(this).attr('data-id');
                    cptIdsList = _.without(cptIdsList,~~cptIdRemoved);
                    $('#' + ulList).data('cptIds',cptIdsList);
                    $(this).closest('li').remove();
                    return;
                });
                $('#' + ulList).data('cptIds',[]);

            },
            bindReferringPhysicianAutoComplete: function (fieldID, userMessage, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID:  '#' + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: '/referringPhysiciansAutoComplete',
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: 'name'
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td class='movie-info'><div class='movie-title'><b>" + res.name + "</b></div>";
                        markup += "</td></tr></table>";
                        return markup;
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('referringPhysicianIdAdded',~~res.id);
                        $('#' + btnAdd).data('referringPhysicianNameAdded',res.name);
                        return res.name;
                    }
                });
                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }
                    var referringPhysicianIdsList = $('#' + ulList).data('referringPhysicianIds') || [],
                        referringPhysicianIdAdded = $(this).data('referringPhysicianIdAdded'),
                        referringPhysicianNameAdded = $(this).data('referringPhysicianNameAdded');

                    // Check to see if patients already exists in the box
                    if (_.indexOf(referringPhysicianIdsList,referringPhysicianIdAdded) !== -1) {
                        commonjs.showError("Referring Physician Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + referringPhysicianNameAdded + '</span><a class="remove" data-id="' + referringPhysicianIdAdded + '" id="' + referringPhysicianIdAdded + '" data-value="' + referringPhysicianNameAdded + '"><span class="icon-ic-close"></span></a></li>');

                        referringPhysicianIdsList.push(~~referringPhysicianIdAdded);
                        $('#' + ulList).data('referringPhysicianIds',referringPhysicianIdsList);
                    }
                });

                $('#' + ulList).on('click','a.remove',function() {
                    var referringPhysicianIdsList = $('#' + ulList).data('referringPhysicianIds') || [],
                        referringPhysicianIdRemoved = $(this).attr('data-id');

                    referringPhysicianIdsList = _.without(referringPhysicianIdsList,~~referringPhysicianIdRemoved);
                    $('#' + ulList).data('referringPhysicianIds',referringPhysicianIdsList);
                    $(this).closest('li').remove();
                    return;
                });

                $('#' + ulList).data('referringPhysicianIds',[]);
            },

            bindUsersAutoComplete: function (fieldID, userMessage, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID:  '#' + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: '/usersAutoComplete',
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: 'username',
                            sortOrder: 'Asc',
                            from: 'provider'
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td class='movie-info'><div class='movie-title'><b>" + res.username + "</b></div>";
                        markup += "</td></tr></table>";
                        return markup;
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('userIdAdded',~~res.id);
                        $('#' + btnAdd).data('userNameAdded',res.username);
                        return res.username;
                    }
                });
                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }
                    var userIdsList = $('#' + ulList).data('userIds') || [],
                        userIdAdded = $(this).data('userIdAdded'),
                        userNameAdded = $(this).data('userNameAdded');

                    // Check to see if patients already exists in the box
                    if (_.indexOf(userIdsList,userIdAdded) !== -1) {
                        commonjs.showError("User Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + userNameAdded + '</span><a class="remove" data-id="' + userIdAdded + '" id="' + userIdAdded + '" data-value="' + userNameAdded + '"><span class="icon-ic-close"></span></a></li>');

                        userIdsList.push(~~userIdAdded);
                        $('#' + ulList).data('userIds',userIdsList);
                    }
                });

                $('#' + ulList).on('click','a.remove',function() {
                    var userIdsList = $('#' + ulList).data('userIds') || [],
                        userIdRemoved = $(this).attr('data-id');

                    userIdsList = _.without(userIdsList,~~userIdRemoved);
                    $('#' + ulList).data('userIds',userIdsList);
                    $(this).closest('li').remove();
                    return;
                });

                $('#' + ulList).data('userIds',[]);
            },

            bindInsuranceProviderGroupAutocomplete: function (fieldID, fieldName, userMessage, facilityIDs, btnAdd, ulList ) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID: "#" + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: "/insuranceProviders",
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            from: 'autocomplete',
                            sortField: "insurance_providers.insurance_code",
                            facility: commonjs.orderFacility,
                            facilities: facilityIDs,
                            sortOrder: "asc"
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var insurance_info = commonjs.hstoreParse(res.insurance_info);
                        var param = {
                            code: res.insurance_code ? res.insurance_code  : ' ',
                            name: res.insurance_name ? res.insurance_name : ' ',
                            address: insurance_info.Address1 ? insurance_info.Address1 :' ',
                            city: insurance_info.City ? insurance_info.City : ' ',
                            state: insurance_info.State ? insurance_info.State : ' ',
                            zip: insurance_info.ZipCode ? insurance_info.ZipCode : ' '
                        }
                        return commonjs.formatInsuranceACResult(param);
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('insuranceIdAdded',~~res.id);
                        $('#' + btnAdd).data('insuranceNameAdded',res.insurance_name);
                        return res.insurance_name;
                    }
                });
                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }

                    // Check to see if this insurance already exists in the box
                    var insuranceIdsList = $('#' + ulList).data('insuranceIds') || [],
                        insuranceIdAdded = $(this).data('insuranceIdAdded');
                    insuranceNameAdded = $(this).data('insuranceNameAdded');

                    // Check to see if insurance already exists in the box
                    if (_.indexOf(insuranceIdsList,insuranceIdAdded) !== -1) {
                        commonjs.showError("Insurnace Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + insuranceNameAdded + '</span><a class="remove" data-id="' + insuranceIdAdded + '" id="' + insuranceIdAdded + '" data-value="' + insuranceNameAdded + '"><span class="icon-ic-close"></span></a></li>');
                        insuranceIdsList.push(~~insuranceIdAdded);
                        $('#' + ulList).data('insuranceIds',insuranceIdsList);
                    }
                });
                $('#' + ulList).on('click','a.remove',function() {
                    var insuranceIdsList = $('#' + ulList).data('insuranceIds') || [],
                        insuranceIdRemoved = $(this).attr('data-id');
                    patientIdsList = _.without(insuranceIdsList,~~insuranceIdRemoved);
                    $('#' + ulList).data('insuranceIds',insuranceIdsList);
                    $(this).closest('li').remove();
                    return;
                });
                $('#' + ulList).data('insuranceIds',[]);
            },

            bindBillingProvider: function() {
                jQuery.ajax({
                    url: "/getBillingProviderInfo",
                    type: "GET",
                    data: {
                        siteId: app.siteID,
                        from : 'patient_statement'
                    },
                    success: function (model, response) {
                        if (model && model.result) {
                            var ddlBillingProvider = $('#ddlBillingProvider');
                            // ddlDefaultBillingProviderReport.append($('<option/>', { value: "all", text: "All" }));
                            var order_info = model.result.billingProviders;
                            if (order_info && order_info.length > 0) {
                                for (var b = 0; b < order_info.length; b++) {
                                    var element = $('<option></option>');
                                    element.val(order_info[b].id).text(order_info[b].full_name);
                                    ddlBillingProvider.append(element);
                                }
                            }
                        }
                        // For Multi Select drop down 
                        $('#ddlBillingProvider').multiselect({
                            maxHeight: 200,
                            buttonWidth: '200px',
                            enableFiltering: true,
                            includeSelectAllOption: true,
                            enableCaseInsensitiveFiltering: true
                        });
                    }                    
                })
            },
            bindBillingProviderMultiSelect: function() {
                jQuery.ajax({
                    url: "/getBillingProviderInfo",
                    type: "GET",
                    data: {
                        siteId: app.siteID,
                        from : 'claim transaction'
                    },
                    success: function (model, response) {
                        if (model && model.result) {
                            var ddlBillingProvider = $('#billingCheckboxes');
                            var billingProviders = model.result.billingProviders;
                            if (billingProviders && billingProviders.length > 0) {
                                for (var b = 0; b < billingProviders.length; b++) {
                                    var id = billingProviders[b].id;
                                    var full_name = billingProviders[b].full_name;
                                    ddlBillingProvider.append('<div class="billingProviderchkBx ddl"><input class="billingProvider ddl" id=billingProvider_'+ id +' type="checkbox" name="allBillingProviders" value="'+id+'"> <label class="checkbox-inline" id="billingProvider_'+id+'" for="billingProvider_'+id+'"> '+full_name+'</label> </input></div>');
                                }
                            }
                        }
                    }
                })
            },

            listUsersAutoComplete: function (userMessage) {
                commonjs.setAutocompleteInfinite({
                    containerID: '#txtUsers',
                    inputLength: 0,
                    placeHolder: userMessage,
                    URL: "/usersAutoComplete",
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: 'username',
                            sortOrder: 'Asc',
                            from: 'provider'
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        return commonjs.formatACResult(res.username, "", res.is_active);
                    },
                    formatSelection: function (res) {
                        $('#txtUsers')[0].disabled = false;
                        if (res.is_active == false) {
                            commonjs.helpConfirm({
                                icon: "fa fa-plus",
                                head: "Add Inactive",
                                hi18n: "messages.confirm.addInactive",
                                body: "Are you sure that you want to add this inactive selection?",
                                bi18n: "messages.confirm.addInactiveAreYouSure",
                                buttons: [
                                    {
                                        text: "Yes",
                                        click: function () {
                                            $('#txtUsers').val(res.username);
                                            $('#btnAddUsers').attr('data-id', res.id);
                                        }
                                    },
                                    {
                                        text: "No",
                                        click: function () {
                                            $('#txtUsers').val(res.username);
                                            $('#txtUserID').val("");
                                            res.username = "";
                                            $('#txtUsers').select2('data', {id: '', text: ''});

                                        }
                                    }
                                ]
                            });
                        }
                        else {
                            $('#txtUsers').val(res.username);
                            $('#btnAddUsers').attr('data-id', res.id);
                        }
                        return res.username;
                    }
                });
            },

            setEvents: function () {
                $('#btnAddUsers').unbind('click').click(function () {
                    if ($('#s2id_txtUsers > a.select2-default').length > 0 ) {
                        commonjs.showWarning('Please select one user to add');
                        return false;
                    }
                    if ($('#ulListUsers li a[data-id="' + $(this).attr('data-id') + '"]').length) {
                        commonjs.showWarning("User is already selected");
                        return false;
                    }
                    $('#ulListUsers').append('<li id="' + $('#btnAddUsers').attr('data-id') + '"><span>' + $('#s2id_txtUsers a span').html() + '</span><a class="remove" data-id="' + $('#btnAddUsers').attr('data-id') + '"><span class="icon-ic-close"></span></a></li>')
                    $('#txtUsers a span').html('Select User');
                });


                $('#ulListUsers').delegate('a.remove', 'click', function () {
                    $(this).closest('li').remove();
                });
            },

            bindPatient: function (fieldID, userMessage, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID:  '#' + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: "/patientAutoComplete",
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            from: 'autocomplete',
                            sortField: "patients.id",
                            sortOrder: "ASC",
                            flag: 'reports',
                            providercontact_ids: app.providercontact_ids
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        return commonjs.formatPatientAutoComplete(res.full_name, res.gender, res.birth_date ? commonjs.getFormattedDate(res.birth_date) : '', res.account_no, res.is_active);
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('patientIdAdded',~~res.id);
                        $('#' + btnAdd).data('patientNameAdded',res.full_name);
                        return res.full_name;
                    }
                });

                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }

                    // Check to see if this patient already exists in the box
                    var patientIdsList = $('#' + ulList).data('patientIds') || [],
                        patientIdAdded = $(this).data('patientIdAdded');
                        patientNameAdded = $(this).data('patientNameAdded');

                    // Check to see if patients already exists in the box
                    if (_.indexOf(patientIdsList,patientIdAdded) !== -1) {
                        commonjs.showError("Patient Already Added");
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + patientNameAdded + '</span><a class="remove" data-id="' + patientIdAdded + '" id="' + patientIdAdded + '" data-value="' + patientNameAdded + '"><span class="icon-ic-close"></span></a></li>');

                        patientIdsList.push(~~patientIdAdded);
                        $('#' + ulList).data('patientIds',patientIdsList);
                    }
                });

                $('#' + ulList).on('click','a.remove',function() {
                    var patientIdsList = $('#' + ulList).data('patientIds') || [],
                        patientIdRemoved = $(this).attr('data-id');
                    patientIdsList = _.without(patientIdsList,~~patientIdRemoved);
                    $('#' + ulList).data('patientIds',patientIdsList);
                    $(this).closest('li').remove();
                    return;
                });
                $('#' + ulList).data('patientIds',[]);
            },

            bindProviderGroupAutoComplete: function (fieldID, userMessage, btnAdd, ulList) {
                var self = this;
                commonjs.setAutocompleteInfinite({
                    containerID:  '#' + fieldID,
                    placeHolder: userMessage,
                    inputLength: 0,
                    URL: '/providerGroupAutoComplete',
                    data: function (term, page) {
                        return {
                            pageNo: page,
                            pageSize: 10,
                            q: term,
                            sortField: 'name'
                        };
                    },
                    results: function (data, page) {
                        var more = data.result.length > 0 ? (page * 10) < data.result[0].total_records : false;
                        return {results: data.result, more: more};
                    },
                    formatID: function (obj) {
                        return obj.id;
                    },
                    formatResult: function (res) {
                        var markup = "<table class='ref-result' style='width: 100%'><tr>";
                        markup += "<td class='movie-info'><div class='movie-title'><b>" + res.name + "</b></div>";
                        markup += "</td></tr></table>";
                        return markup;
                    },
                    formatSelection: function (res) {
                        $('#' + btnAdd).data('idAdded',~~res.id);
                        $('#' + btnAdd).data('nameAdded',res.name);
                        return res.name;
                    }
                });

                $('#' + btnAdd).click(function() {
                    if ($('#s2id_' + fieldID + ' > a.select2-default').length > 0) {
                        return false;
                    }

                    // Check to see if this patient already exists in the box
                    var idsList = $('#' + ulList).data('ids') || [],
                        idAdded = $(this).data('idAdded'),
                        nameAdded = $(this).data('nameAdded');

                    // Check to see if patients already exists in the box
                    if (_.indexOf(idsList,idAdded) !== -1) {
                        commonjs.showError(userMessage.replace('Search ', '') + ' Already Added');
                        return false;
                    } else {
                        $('#' + ulList).append('<li><span>' + nameAdded + '</span><a class="remove" data-id="' + idAdded + '" id="' + idAdded + '" data-value="' + nameAdded + '"><span class="icon-ic-close"></span></a></li>');

                        idsList.push(~~idAdded);
                        $('#' + ulList).data('ids',idsList);
                    }
                });

                $('#' + ulList).on('click','a.remove',function() {
                    var idsList = $('#' + ulList).data('ids') || [],
                        idRemoved = $(this).attr('data-id');
                    idsList = _.without(idsList,~~idRemoved);
                    $('#' + ulList).data('ids',idsList);
                    $(this).closest('li').remove();
                    return;
                });

                $('#' + ulList).data('ids',[]);
            },
            
            /**
             * Fetch all the modalities for a facility. 'active modalities and 'all' modalities is passed to a callback
             *
             * @param callback
             */
            fetchModalities: function(callback) {
                var modalityList = new ModalityList;
                modalityList.fetch({
                    data: {
                        'sortField': 'modality_code',
                        'sortOrder': 'asc',
                        'pageSize': 1000,
                        'pageNo': 1,
                        'filterCol': '[]',
                        'filterData': '[]'
                    },
                    processData: true,
                    success: function (model, response) {
                        var active = [];
                        var modalities = response.result;
                        if (!_.isEmpty(modalities)) {
                            active = _.filter(modalities, function(modality) {
                                return modality.is_active;
                            });
                        }

                        callback(null, {
                            'active': active,
                            'all': !_.isEmpty(modalities) ? modalities : []
                        });
                    }
                });
            },

            /**
             * Helper function used in multiple reporting views to easily replace the dropdown option values in a select
             * for a list of modality codes, given the select box id, the array of options, and the val and the text
             * attribute that is used in the array of options for the value and text html properties
             *
             * @param {String} select id of the select box
             * @param {object[]} options An array of new options
             * @param {String} val The value to access on the option object for setting the option value
             * @param {String} text The value to access on the options object for setting the option text
             */
            replaceModalityOptions: function(select, options, val, text) {
                var $select = $('#' + select);
                $select.empty();

                _.each(options, function(option) {
                    var $option = $("<option data-attr-id='" + option.id + "'></option>")
                        .attr("value", option[val])
                        .text(option[text]);

                    if (!option.is_active) {
                        $option.addClass('report__inactive-modality');
                    }

                    $select.append($option);
                });
            },

            /**
             * Get the list of inactive modality codes from the modality select box we use everywhere (#ddlModalities)
             *
             * @returns {Array}
             */
            getInactiveModalityCodes: function() {
                var inactiveModalityCodes = [];
                var selectedModalities = $('#ddlModalities').find(':selected');

                _.each(selectedModalities, function(modality) {
                    var $modality = $(modality);

                    if ($modality.hasClass('report__inactive-modality')) {
                        inactiveModalityCodes.push($modality.val());
                    }
                });

                return inactiveModalityCodes;
            }
        };

        return UI;

    });
