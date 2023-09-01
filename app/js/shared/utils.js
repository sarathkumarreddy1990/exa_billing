define([ 'jquery' ], function ( jQuery ) {
    var $ = jQuery;
    var _TRUE = 'true';
    var _FALSE = 'false';

    var isTrue = function ( val ) {
        return val === true || val === _TRUE;
    };

    var isFalse = function ( val ) {
        return val === false || val === _FALSE;
    };

    var isNotTrue = function ( val ) {
        return val !== true && val !== _TRUE;
    };

    var isNotFalse = function ( val ) {
        return val !== false && val !== _FALSE;
    };

    /**
     * getData - Essentially identical to sister method in customgrid.js but usable on any grid/store.
     * @param {string|number}   id
     * @param {Object}          store
     * @param {string}          [tableID]
     * @param {Object}          [searchObj]
     * @returns {Object}
     */
    var getData = function ( id, store, tableID, searchObj ) {
        var model = store.get(id) || searchObj && store.findWhere(searchObj);
        var data = model && model.toJSON() || tableID && $(tableID).jqGrid('getRowData', id) || null; // fallback
        if ( data === null || typeof data === 'object' && Object.keys(data).length === 0 ) {
            commonjs.showError('Error getting data for row - ID: ' + id);
            console.log('getData - ID: ', id, ' | store: ', store);
        }
        return data;
    };


    var disableRightClick = function () {
        if (app.usersettings && app.usersettings.filter_info && app.usersettings.filter_info.options) {
            return !isTrue(app.usersettings.filter_info.options.disableRightClick);
        }
        return true;
    };

    var setRightMenuPosition = function ( divObj, e ) {
        var $menu = $(document.getElementById(divObj));
        if (!$menu.children().length) {
            return;
        }

        var mouseX = e.clientX;
        var mouseY = e.clientY;
        var boundsX = $(window).width();
        var boundsY = $(window).height();
        var menuWidth = $menu.outerWidth();
        var menuHeight = $menu.outerHeight();
        var menuOffLeft = (mouseX - menuWidth) < 0;
        var menuOffRight = (mouseX + menuWidth) > boundsX;
        var submenuOffRight = (mouseX + menuWidth * 3) > boundsX;
        var x;
        var y;

        $menu
            .show()
            .removeClass('dropdown-context')
            .removeClass('dropdown-context-up')
            .removeClass('dropdown-context-left');

        // Menu Top
        if (mouseY + menuHeight > boundsY) {
            var cTop = Math.max(mouseY - menuHeight, ~~$('#indexHeader').height());
            y = { "top": cTop };
            $menu.addClass('dropdown-context-up');
        } else {
            y = { "top": mouseY };
        }

        // Menu Left
        if (menuOffRight && !menuOffLeft) {
            x = { "left": mouseX - menuWidth };
            $menu.addClass('dropdown-context-left');
        } else {
            x = { "left": mouseX };
            $menu.addClass('dropdown-context');
        }

        // Display submenu on the left if it would go off the right side of the screen
        if (submenuOffRight) {
            $menu.find(".dropdown-submenu").addClass("pull-left");
        }

        $menu.css($.extend(y, x));
    };

    var updateCollection = function ( dataset, something, pager ) {
        var pageoffset = (pager.get('PageNo') - 1) * pager.get('PageSize');
        var j = 0;
        var count = dataset.length;
        for ( ; j < count; j++ ) {
            pageoffset = pageoffset + 1;
            dataset[ j ].set({
                'record_no': pageoffset
            }, {
                'silent': true
            });
        }
        //getTATCount();
    };

    var updateColumn = function (studyFields, isClaimGrid) {
        var field_order = [];
        var gridOptions = studyFields.map(function (col) {
            field_order[field_order.length] = col.id;
            return {
                'id': col.id,
                'name': col.field_name,
                'width': col.field_info.width || 0
            };
        });
        var gridName = isClaimGrid ? 'claims' : 'studies';
        jQuery.ajax({
            "url": "/exa_modules/billing/user_settings/update_grid_settings",
            "type": "POST",
            "data": {
                "gridName": gridName,
                "fieldOrder": field_order,
                "gridOptions": JSON.stringify(gridOptions)
            },
            "success": function (data) {
                if (data) {
                    if (isClaimGrid) {
                        app.claim_user_settings.field_order = field_order;
                        app.claim_user_settings.grid_field_settings = gridOptions;
                    } else {
                        app.study_user_settings.field_order = field_order;
                        app.study_user_settings.grid_field_settings = gridOptions;
                    }
                }
            },
            "error": function (err) {
                commonjs.handleXhrError(err);
            }
        });
    };

    var setScrollHandler = function ( filterid, divId ) {
        var divid = "#divGrid" + filterid;
        var scrolldiv = "";

        if ( $(divid).find("#gview_tblGrid" + filterid).length > 0 ) {
            scrolldiv = $(divid).find("#gview_tblGrid" + filterid).find(".ui-jqgrid-bdiv");
        }

        scrolldiv.scroll(function () {
            $(divId).hide();
        });
    };

    return {
        isTrue: isTrue,
        isFalse: isFalse,
        isNotTrue: isNotTrue,
        isNotFalse: isNotFalse,
        getData: getData,
        disableRightClick: disableRightClick,
        setRightMenuPosition: setRightMenuPosition,
        updateCollection: updateCollection,
        updateReorderColumn: updateColumn,
        updateResizeColumn: updateColumn,
        setScrollHandler: setScrollHandler
    };
});
