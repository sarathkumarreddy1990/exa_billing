define('change-grid', [ 'jquery' ], function ( jQuery ) {
    var $ = jQuery;
    var dateFormatter = function ( value, data ) {
        return commonjs.checkNotEmpty(value) ?
               commonjs.convertToFacilityTimeZone(data.facility_id, value).format('L LT z') :
               '';
    };
    return function ( filter ) {
        var $tblGrid = filter.grid || filter.options && filter.options.grid;
        var getRow = function ( $row ) {
            return typeof $row === 'string' ?
                   $tblGrid.find('#' + $row) :
                   $row;
        };

        var setCell = function ( $row ) {
            $row = getRow($row);
            var $td = $row.children('td');
            var regHash = /#/;
            return function ( obj ) {
                var setData = function ( cell ) {
                    var field = cell.field;
                    var data = cell.data;
                    var css = cell.css;
                    var callback = cell.callback;
                    var className = cell.className;
                    var tblID = filter.options.gridelementid.replace(regHash, '');
                    var $cell = $td.filter('[aria-describedby="' + tblID + '_' + field + '"]');
                    if ( $cell.length > 0 ) {
                        if ( typeof data === 'string' ) {
                            $cell.html(data)
                                .attr('title', $.jgrid.stripHtml(data));
                        }
                        if ( typeof css === 'object' ) {
                            $cell.css(css);
                        }
                        if ( typeof className === 'string' ) {
                            $cell[ 0 ].className = className.trim();
                        }
                        if ( typeof callback === 'function' ) {
                            return callback($cell);
                        }
                    }
                };
                if ( Array.isArray(obj) && obj.length > 0 ) {
                    var i = 0;
                    var count = obj.length;
                    var cell;
                    for ( ; i < count; ++i ) {
                        cell = obj[ i ];
                        if ( cell ) {
                            setData(cell);
                        }
                    }
                }
                else if ( typeof obj === 'object' ) {
                    setData(obj);
                }
            };
        };

        var setEligibility = function ( value, data ) {
            var html = '';
            /**
             * First see if automated eligibility check already
             * returned something we can use
             */
            var eligibilityDate = data.eligibility_dt;
            var verifiedDate = data.manually_verified_dt;
            if ( eligibilityDate && !verifiedDate || moment(eligibilityDate).isAfter(verifiedDate) ) {
                if ( value === false ) {
                    html = '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" title="Verified using automated system - inactive coverage" />';
                }
                else {
                    html = '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="Verified using automated system" />';
                }
            }
            else if ( verifiedDate ) {
                /**
                 * For when a user manually verified eligibility
                 */
                var verifiedBy = data.manually_verified_by;
                var titleText = 'Changed (manually) by ' + verifiedBy + ' on ' + dateFormatter(verifiedDate, data);
                if ( value === false ) {
                    html = '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" title="' + titleText + '" />';
                }
                else {
                    html = '<i class="fa fa-check-square-o" style="color: green" aria-hidden="true" title="' + titleText + '" />';
                }
            }
            else {
                /**
                 * Default appearance
                 */
                html = '<i class="fa fa-square-o" style="color: #FF9000" aria-hidden="true" />';
            }
            return [{
                'field': 'eligibility_verified',
                'data': html
            }];
        };

        var setWaitingTime = function ( $row, data ) {
            $row = getRow($row);
            var regGrid = /#tblGrid/;
            var filterID = filter.options.gridelementid.replace(regGrid, '');
            if ( !data.has_deleted && filterID.indexOf('ExceedStudy') === -1 && data.current_status_waiting_time > 0 && data.max_waiting_time > 0 && (data.max_waiting_time > data.current_status_waiting_time) ) {
                $row.removeClass('warnExceedTime').addClass('warnExceedTime');
                $row.attr('data_interval', 1);
            }
            else {
                $row.removeClass('warnExceedTime');
            }
            return [];
        };

        var setDeleted = function ( $row, value ) {
            $row = getRow($row);
            if ( value !== true ) {
                $row.removeClass('inActiveRow');
                return [{
                    'field': 'has_deleted',
                    'data': 'No'
                }];
            }
            else {
                $row.addClass('inActiveRow');
                return [{
                    'field': 'has_deleted',
                    'data': 'Yes'
                }];
            }
        };

        var getStatLevelAttr = function ( value ) {
            var stat_lvl = parseInt(value, 10);
            var statObj = stat_lvl > 0 ?
                          app.stat_level[ stat_lvl ] :
                          null;
            if ( statObj ) {
                return {
                    'bgColor': statObj.color,
                    'textColor': statObj.text_color,
                    'text': statObj.description
                };
            }
            else {
                return {
                    'bgColor': 'transparent',
                    'textColor': '',
                    'text': ''
                };
            }
        };

        var getStatLevel = function ( $row, value ) {
            $row = getRow($row);
            var processed = getStatLevelAttr(value);

            $row.css({
                "backgroundColor": processed.bgColor,
                "color": processed.textColor
            });

            return [
                {
                    'field': 'stat_level',
                    'data': processed.text,
                    'css': {
                        "backgroundColor": processed.bgColor,
                        "color": processed.textColor
                    }
                }
            ];

            /*
             // Gotta hold off on this til we can successfully count all the current stat levels first.
             // Otherwise we're just adding and adding without removing what's changed
             var $statCount = $("#statCount" + stat_lvl);
             var newCount = 1 + Number($statCount.text());
             $statCount.text(newCount);*/
        };

        var getTATLevel = function ( value ) {
            return [
                {
                    'field': 'tat_level',
                    'data': commonjs.getTatValue(value)
                }
            ];
        };

        var tranStatus = [
            "TRAN",
            "UNR",
            "DIC",
            "DRFT",
            "APP",
            "PRAP",
            "RE",
            "APCD",
            "NOA"
        ];

        var _getTranscription = function ( value ) {
            return tranStatus.indexOf(value) > -1 ?
                   "<i class='icon-ic-raw-transctipt' title='Transcription'></i>" :
                   "";
        };

        var getTranscription = function ( value ) {
            return [
                {
                    'field': 'as_transcription',
                    'data': _getTranscription(value)
                }
            ];
        };

        var reportStatus = [
            "APP",
            "APCD",
            "PRAP"
        ];

        var _getReport = function ( value ) {
            return ( reportStatus.indexOf(value) > -1 ) ?
                   "<span class='icon-ic-reports' title='Approved Report'></span>" :
                   "";
        };

        var getReport = function ( value ) {
            return [
                {
                    'field': 'as_report',
                    'data': _getReport(value)
                }
            ];
        };

        var getStudyStatus = function ( data ) {
            var code = data.status_code;
            var statusDetail = code === "TE" ?
                               commonjs.getColorCodeForStatus(data.facility_id, "INC") :
                               commonjs.getColorCodeForStatus(data.facility_id, code !== null ?
                                                                                code :
                                                                                data.order_status_code);
            var status = statusDetail[ 0 ];
            return [
                {
                    'field': 'study_status',
                    'data': status && status.status_desc || '',
                    'css': { 'background': status && status.color_code || 'transparent' }
                }, {
                    'field': 'status_code',
                    'data': code
                }
            ].concat(getTranscription(code)).concat(getReport(code));
        };

        var getOrderStatus = function ( data ) {
            var code = data.order_status_code;
            var statusDetail = data.order_status_code === "TE" ?
                               commonjs.getColorCodeForStatus(data.facility_id, "INC") :
                               commonjs.getColorCodeForStatus(data.facility_id, data.order_status_code);
            var status = statusDetail[ 0 ];
            return [
                {
                    'field': 'order_status',
                    'data': status && status.status_desc || '',
                    'css': { 'background': status && status.color_code || 'transparent' }
                }, {
                    'field': 'order_status_code',
                    'data': code
                }
            ];
        };

        var getTempStudyStatus = function ( value ) {
            var statusDetail = commonjs.getTempStatus(value);
            return statusDetail ?
                [
                    {
                        'field': 'dicom_status',
                        'data': statusDetail.statusDesc,
                        'css': {
                            'backgroundColor': statusDetail.statusColorCode
                        }
                    }
                ] :
                [];
        };

        var getLinkStudy = function ( data ) {
            return [
                {
                    'field': 'linked_study_id',
                    'data': data.linked_study_id
                }, {
                    'field': 'patient_name',
                    'data': '<span class="linkSpan"><span>' + data.patient_name + '</span><span title="linked study" style="display:inline-block;" class="ui-icon ui-icon-link linkSpan"></span></span>'
                }
            ];
        };

        var getUnlinkStudy = function ( $row ) {
            $row = getRow($row);
            $row.children('td')
                .filter('[aria-describedby="' + filter.options.gridelementid.replace(/#/, '') + '_patient_name"]')
                .find('span')
                .removeClass('ui-icon ui-icon-link');
            return [];
        };

        var getLocked = function ( locked_by ) {
            var html = locked_by ?
                       "<i class='fa fa-lock' style='color: red; font-weight: bold;' title='Locked by " + locked_by + "'></i>" :
                       "";
            return [
                {
                    'field': 'as_locked_by',
                    'data': html
                }, {
                    'field': 'locked_by',
                    'data': locked_by
                }
            ];
        };

        var getAuthorizations = function ( value ) {
            var createEl = function ( cellvalue ) {
                var authorizations = cellvalue;

                if (authorizations.length > 0 && typeof authorizations === 'string') {
                    authorizations = JSON.parse(authorizations);
                }

                if ( authorizations && authorizations.length ) {
                    var needsAuth = false;
                    var authorized = false;
                    var menuHtml = '<ul class="authList" style="position:absolute;display:none;border: solid 1px #EEEEEE;">';
                    var icon = "<span class='icon-ic-status' title='No Authorization Needed'></span>";
                    var i = 0;
                    for ( ; i < authorizations.length; i++ ) {
                        if ( authorizations[ i ].status === "NeedAuthorization" ) {
                            needsAuth = true;
                            icon = "<span style='color: red' class='icon-ic-status' title='Need Authorization'></span>";
                        }
                        if ( authorizations[ i ].status === "Authorized" ) {
                            authorized = true;
                            icon = "<span style='color: #008000' class='icon-ic-status' title='Authorized'></span>";
                        }

                        menuHtml = menuHtml + '<li style="padding:0 20px;" class="customRowSelect" data-study-cpt-id="' + authorizations[ i ].study_cpt_id + '">' + icon + '<span style="padding-left: 20px;">' + authorizations[ i ].cpt_desc + '</span></li>';
                    }
                    menuHtml = menuHtml + '</ul>';

                    var dataValue = " data-value='" + base64.encode(JSON.stringify(cellvalue)) + "'";

                    if ( needsAuth ) {
                        return "<span style='color: red' class='icon-ic-status' title='Need Authorization'" + dataValue + "></span>" + menuHtml;
                    }
                    else if ( authorized ) {
                        return "<span style='color: #008000' class='icon-ic-status' title='Authorized'" + dataValue + "></span>" + menuHtml;
                    }
                    return "<span class='icon-ic-status' title='No Authorization Needed'" + dataValue + "></span>" + menuHtml;
                }
                return "";
            };
            return [
                {
                    'field': 'as_authorization',
                    'data': createEl(value)
                }
            ];
        };

        var getNotes = function ( data ) {
            var isEmpty = data.empty_notes_flag;
            var asNotes = isEmpty ? {
                'field': 'as_notes',
                'data': "<span class='icon-ic-info' title='Notes Empty'></span>"
            } : {
                'field': 'as_notes',
                'data': "<span class='icon-ic-info icon-note-color' title='Notes'></span>"
            };
            var notes = commonjs.formatJson(data.notes);
            if ( notes && !notes.length ) {
                var notesField = {
                    'field': 'notes',
                    'data': '',
                    'css': {
                        'textOverflow': 'ellipsis'
                    }
                };
            }
            else {
                var note = notes[ notes.length - 1 ];
                var notesCol = note && note.notes;
                notesField = {
                    'field': 'notes',
                    'data': notesCol
                };
            }
            return [ asNotes, notesField ];
        };

        var getOrderNotes = function ( value ) {
            var notes = commonjs.formatJson(value);
            if ( notes && notes.length && notes.length === 0 ) {
                var notesCol = "";
            }
            else {
                var note = notes[ notes.length - 1 ];
                notesCol = note && note.notes;
            }
            return [
                {
                    'field': 'order_notes',
                    'data': notesCol
                }
            ];
        };

        var getPrior = function ( data ) {
            var cells = [
                {
                    'field': 'as_prior',
                    'data': !data.has_priors ?
                            "<i class='icon-ic-prior-studies' style='opacity:.3' title='Prior'></span>" :
                            "<i class='icon-ic-prior-studies' title='Prior'></span>"
                }
            ];
            /**
             * HIDE subgrid button conditions:
             *
             *  +-----------------------------------------------------------------------------------------+
             * | showpriors ON, has_priors FALSE (so don't show series/instances either)
             * | showpriors OFF, images missing (dicom_status is not CO or IP or there is no instance count)
             * | Above conditions + is not QC tab (will always show subgrid icon)
             * +------------------------------------------------------------------------------------------+
             *
             * The default is to show this button, so only bother with a negative condition here to remove it.
             */
            if (
                app.showpriors && !data.has_priors ||
                !app.showpriors && (
                    data.dicom_status !== "CO" && data.dicom_status !== "IP" ||
                    data.no_of_instances < 1
                )
            ) {
                cells[ cells.length ] = {
                    'field': 'subgrid',
                    'className': '',
                    'data': ''
                };
            }
            else {
                cells[ cells.length ] = {
                    'field': 'subgrid',
                    'className': 'ui-sgcollapsed sgcollapsed',
                    'data': '<a href="javascript:void(0);"><span class="ui-icon ui-icon-plus" data-original-title="" title=""></span></a>'
                };
            }
            return cells;
        };

        var getViewers = function ( data ) {
            if ( !(data.linked_study_id > 0) && ((data.dicom_status !== "CO" && data.dicom_status !== "IP") || data.no_of_instances == 0) ) {
                return [
                    {
                        'field': 'as_webviewer',
                        'data': ''
                    }, {
                        'field': 'as_opal',
                        'data': ''
                    }, {
                        'field': 'as_localprefetchviewer',
                        'data': ''
                    }
                ];
            }
            else {
                return [
                    {
                        'field': 'as_webviewer',
                        'data': "<i class='icon-ic-web-viewer' title='DICOM Viewer'></i>"
                    }, {
                        'field': 'as_opal',
                        'data': "<i class='icon-ic-opal-viewer' title='Opal Viewer'></i>"
                    }, {
                        'field': 'as_localprefetchviewer',
                        'data': "<span class='icon-ic-external-app' title='External app[To be implemented]'></span>"
                    }
                ];
            }
        };

        var getHasUnreadDicom = function ( data ) {
            var html = data.has_unread_dicoms ?
                       "<span class='icon-ic-alerts' title='Unread dicom' style='background-color:#4BB748; text-align: center;'></span>" :
                       "";
            return [
                {
                    'field': 'as_has_unread_dicom',
                    'data': html
                }
            ];
        };

        var getMU = function ( data ) {
            var html = ( data.mu_passed || data.mu_passed == 'true' ) ?
                       "<span style='color: #008000' class='icon-ic-drawer' title='MU Data Capture Completed'></span>" :
                       "<span style='color: brown' class='icon-ic-drawer' title='MU Data Capture not Completed'></span>";
            return [
                {
                    'field': 'mudatacaptured',
                    'data': html
                }
            ];
        };

        var getRefPhy = function ( data ) {
            var text = !data.refphy_name || data.refphy_name.trim() === 'No Ordering Physician Selected' ?
                       '' :
                       data.refphy_name;
            return [
                {
                    'field': 'refphy_name',
                    'data': text
                }
            ];
        };

        var getReferringProviders = function ( id, data ) {
            if (data.referring_provider_ids && data.referring_provider_ids != null) {
                var ref_provider_arr = data.referring_providers && data.referring_providers.split('~');
                var provider_ids = data.referring_provider_ids.split('~');
                var content = '';
                if (data.refphy_name != '') {
                    content = data.refphy_name;
                }
                else if (ref_provider_arr && ref_provider_arr.length) {
                    if (app.providerID == 0) {
                        content = ref_provider_arr[0];
                    }
                    else if (provider_ids.length > 0) {
                        var count = provider_ids.indexOf(app.providercontact_ids[ 0 ]);
                        content = ref_provider_arr[ count > -1 ? count : 0 ];
                    }
                }
                var refProvContent = "" +
                    "<span class='linkSpan'></span>" +
                    "<span class='notesSpan' style='white-space: normal;'>" + content + "</span>" +
                    "<span id='provider_" + id + "' data-d_rowid='" + id + "' title='Referring Providers List' style='display: inline-block; margin-left: 3px;' class='fa fa-user-md' data-toggle='popover'></span>";

                if ( content && content.length > 0 ) {
                    return {
                        'field': 'refphy_name',
                        'data': refProvContent,
                        'callback': function ( $cell ) {
                            var $providerEl = $cell.find('#provider_' + id);
                            $providerEl.click(function () {
                                jQuery.ajax({
                                    url: "/getReferringPhysicianInfo",
                                    type: "GET",
                                    data: {
                                        ref_phy_id: provider_ids.join()
                                    },
                                    success: function ( data ) {
                                        var phtm = "<div style='color: black;'>No information available</div>";
                                        if ( data && data.result && data.result.length > 0 ) {
                                            phtm = data.result.reduce(function ( prev, prov_info ) {
                                                if ( prov_info.address1 && prov_info.address1.trim() == "" ) prov_info.address1 = "N/A";
                                                if ( prov_info.city && prov_info.city.trim() == "" ) prov_info.city = "N/A";
                                                if ( prov_info.state && prov_info.state.trim() == "" ) prov_info.state = "N/A";

                                                var getCityStateZipInfo = function (addressInfo) {
                                                    return $.grep([addressInfo.city, addressInfo.state, addressInfo.zip], Boolean).join(", ");
                                                }
                                                // Construct Provider Information HTML
                                                prev += "<div style='color: black; padding-left: 5px; margin-bottom: 10px;'>" +
                                                    "   <div style='font-weight: bold;'>";

                                                if ( commonjs.checkScreenRight('Provider', true) ) {
                                                    prev += "       <a style='color: blue;' href='javascript:void(0);' " +
                                                        "onclick='showEditProviderModal(" + id + "," + prov_info.provider_id + "," + prov_info.provider_group_id + ");'>" +
                                                        "           " + prov_info.provider_full_name + "" +
                                                        "       </a>";
                                                }
                                                else {
                                                    prev += "       " + prov_info.provider_full_name;
                                                }

                                                prev += "   </div>" +
                                                    "   <div>" + prov_info.address1 + "</div>" +
                                                    "   <div>" + getCityStateZipInfo(prov_info) + "</div>";

                                                if (prov_info.office_phone && prov_info.office_phone != null) prev += "   <div>Office Phone: " + prov_info.office_phone + "</div>";
                                                if (prov_info.phone && prov_info.phone != null) prev += "   <div>Phone: " + prov_info.phone + "</div>";
                                                if (prov_info.office_fax && prov_info.office_fax != null) prev += "   <div>Office Fax: " + prov_info.office_fax + "</div>";
                                                if (prov_info.fax_no && prov_info.fax_no != null) prev += "   <div>Fax: " + prov_info.fax_no + "</div>";
                                                if (prov_info.email && prov_info.email != null) prev += "   <div>Email: <a style='color: blue' href='mailto:" + prov_info.email + "'>" + prov_info.email + "</a></div>";
                                                if (prov_info.providerAlerts && prov_info.providerAlerts!= null ) prev += "   <div style='margin-top: 10px;'>" + prov_info.providerAlerts + "</div>";

                                                prev += "</div>";
                                                return prev;
                                            }, '');
                                        }

                                        var _target = $providerEl;
                                        _target.popover('destroy');
                                        _target.popover({
                                            placement: function () {
                                                if ( $cell.parent().closest('tr').index() < 12 ) {
                                                    return "bottom";
                                                }
                                                else {
                                                    return "top";
                                                }
                                            },
                                            html: true,
                                            content: $("<div style='opacity: 1000001; max-height: 225px; overflow: auto;'></div>").html(phtm)
                                        });
                                        _target.popover('show');
                                    },
                                    error: function ( err ) {
                                        commonjs.handleXhrError(err);
                                    }
                                });
                            });
                        }
                    };
                }
            }
            else {
                return getRefPhy(data);
            }
        };

        /**
         * Shows the edit provider modal and destroys the referring provider popover.
         * Triggered when a user clicks on a referring physician's name inside of the popover
         *
         * @param {Number} rowId the row id the user invoked this method on
         * @param {Number} provId the provider's id #
         * @param {Number} groupId the provider's group id #
         */
        this.showEditProviderModal = function(rowId, provId, groupId) {
            var $popoverEl = $('#provider_' + rowId);
            var url = '#setup/provider/edit/' + provId + '_' + groupId;

            // remove the popover before displaying the edit provider modal
            $popoverEl.popover('destroy');
            commonjs.showDialog({
                header: 'Edit Provider',
                i18nHeader: 'shared.screens.setup.editProvider',
                width: '95%',
                height: '75%',
                url: url,
                onLoad : 'removeIframeHeader()'
            });
        };

        var getReadPhy = function ( id, data ) {
            if ( filter.options.showEncOnly && data.readphy_arr && data.readphy_arr != "" ) {
                var reading_providers = data.readphy_arr.split('~');
                if ( reading_providers && reading_providers.length > 0 ) {
                    var displayContent = reading_providers[ 0 ];
                    var readingContent = '<span class="linkSpan"></span><span class="notesSpan" style="white-space: normal;">' + displayContent + '</span><span title="Reading Physicians List" style="display:inline-block;margin-left: 3px;" class="ui-icon ui-icon-contact" data-toggle="popover" id="readProvider_' + id + '"></span></span>';
                    return [
                        {
                            'field': 'readphy_name',
                            'data': readingContent,
                            'callback': function ( $td ) {
                                var readingProvidersContent = reading_providers.reduce(function ( prev, provider ) {
                                    if ( provider && provider != '' && provider != undefined ) {
                                        return ( prev + '<section class="result-part">' +
                                        '<p style="font-weight: bold; margin-left: 5px;">' + provider + '</p>' +
                                        '</section>' );
                                    }
                                }, '');
                                var _target = $td.find("#readProvider_" + id);
                                _target.popover('destroy');
                                _target.popover({
                                    placement: function () {
                                        if ( $td.parent().closest('tr').index() < 12 )
                                            return "bottom";
                                        else
                                            return "top";
                                    },
                                    html: true,
                                    content: $('<div class="divBackground" style="opacity: 1000001; max-height: 210px;overflow: auto;"></div>').html(readingProvidersContent)
                                });
                            }
                        }
                    ];
                }
            }
            else if ( data.readphy_name ) {
                return [
                    {
                        'field': 'readphy_name',
                        'data': data.readphy_name
                    }
                ];
            }
            else {
                return [
                    {
                        'field': 'readphy_name',
                        'data': data.readphy_name_dicom
                    }
                ];
            }
        };

        var getAge = function ( value ) {
            var text = filter.options.showEncOnly && !value || value == 'undefined' ?
                       '' :
                       value > 0 && value || 0;
            return [
                {
                    'field': 'patient_age',
                    'data': text
                }
            ];
        };
        var getClaimNo = function ( order_status ) {
            var billing_status = [
                "SCH",
                "ORD",
                "CON",
                "ASS",
                "NOS",
                "ASAC",
                "CAN",
                "ABRT"
            ];
            if ( billing_status.indexOf(order_status) > -1 )
                return [
                    {
                        'field': 'claim_no',
                        'data': ''
                    }
                ];
        };
        var getDOB = function ( value ) {
            var text = value ?
                       commonjs.getFormattedUtcDate(value) :
                       '';
            return [
                {
                    'field': 'birth_date',
                    'data': text
                }
            ];
        };

        var getDate = function ( facID, value, field, formatted ) {
            var text = value ?
                       commonjs.convertToFacilityTimeZone(facID, value) :
                       '';
            if ( text && formatted === true ) {
                text = text.format('L LT z');
            }
            return [
                {
                    'field': field,
                    'data': text
                }
            ];
        };

        var gender = {
            'M': 'Male',
            'F': 'Female',
            'U': 'Unknown',
            'O': 'Other'
        };

        var getGender = function ( value ) {
            return [
                {
                    'field': 'gender',
                    'data': value && gender[ value.toUpperCase() ] || 'Unknown'
                }
            ];
        };

        var orderTypes = {
            'S': 'Schedule',
            'W': 'Walkin',
            'P': 'Pre-order'
        };

        var getOrderType = function ( value ) {
            return [
                {
                    'field': 'order_type',
                    'data': value && orderTypes[ value.toUpperCase() ] || ''
                }
            ];
        };

        var getResponsible = function ( value ) {
            var text = value ?
                       value + "(" + commonjs.getPayerType(value) + ")" :
                       '';
            return [
                {
                    'field': 'payer_name',
                    'data': text
                }
            ];
        };

        var setFinalStatus = function ( $row, value ) {
            $row = getRow($row);
            if ( value === true ) {
                var html = "<span class='ui-icon ui-icon-check' title='Manual Edit'></span>";
                $row.addClass('finalStatus');
            }
            else {
                html = "";
                $row.removeClass('finalStatus');
            }
            return [
                {
                    'field': 'status1',
                    'data': html
                }
            ];
        };

        return {
            getRow: getRow,
            setCell: setCell,
            setEligibility: setEligibility,
            setWaitingTime: setWaitingTime,
            setDeleted: setDeleted,
            getStatLevelAttr: getStatLevelAttr,
            getStatLevel: getStatLevel,
            getTATLevel: getTATLevel,
            getTranscription: getTranscription,
            getReport: getReport,
            getStudyStatus: getStudyStatus,
            getOrderStatus: getOrderStatus,
            getTempStudyStatus: getTempStudyStatus,
            getLinkStudy: getLinkStudy,
            getUnlinkStudy: getUnlinkStudy,
            getLocked: getLocked,
            getAuthorizations: getAuthorizations,
            getNotes: getNotes,
            getOrderNotes: getOrderNotes,
            getPrior: getPrior,
            getViewers: getViewers,
            getHasUnreadDicom: getHasUnreadDicom,
            getMU: getMU,
            getRefPhy: getRefPhy,
            getReferringProviders: getReferringProviders,
            getReadPhy: getReadPhy,
            getAge: getAge,
            getDOB: getDOB,
            getDate: getDate,
            getGender: getGender,
            getOrderType: getOrderType,
            getResponsible: getResponsible,
            setFinalStatus: setFinalStatus,
            getClaimNo: getClaimNo
        };
    };
});
