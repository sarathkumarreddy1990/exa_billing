'use strict';
define('grid-events', [ 'jquery', 'underscore', './formatter', './change-grid' ], function ( jQuery, _, Formatter, initChangeGrid ) {
    var $ = jQuery;
    return function ( filterID ) {

        var _findSTAT = function ( levels, stat ) {

            if ( levels.length === 0 || stat >= levels[ 0 ] ) {
                return -1;
            }

            var index = _.findLastIndex(levels, function ( level ) {
                return level > stat;
            });
            return index > -1 ? index : levels.length;

        };

        var _handleSTAT = function ( filter, models, data, id ) {
            id = String(id);
            var $tblGrid = filter.customGridTable || $(filter.options.gridelementid);
            var $tbody = $tblGrid.children('tbody');
            var $rows = $tbody.children('tr');

            // Eliminate any with no stat level (or 0)
            var levels = models.map(function ( model ) {
                return model.get('stat_level') || 0;
            }).filter(function ( level ) {
                return level > 0;
            });

            var stat = data.stat_level;
            var total = levels.length;
            var index = stat === 0 ? total : _findSTAT(levels, stat);

            if ( index < 0 ) {
                $tblGrid.jqGrid('delRowData', id);
                $tblGrid.jqGrid('addRowData', id, data, 'first');
            }
            else {
                // Add an extra to the index to account for the dumb first row
                var $target = $rows.eq(index === total ? index + 1 : index + 2);
                var targetID = $target.attr('id');
                if ( targetID !== id ) {
                    $tblGrid.jqGrid('delRowData', id);
                    $tblGrid.jqGrid('addRowData', id, data, 'after', targetID);
                }
            }
        };

        var applyChanges = function ( filter, id, model, changed ) {
            var data = model.toJSON();
            // Only move things around if the level changed or if it's a new item
            if ( !changed || changed.hasOwnProperty('stat_level') && changed.stat_level !== model.previous('stat_level') ) {
                var previousLevel = model.previous('stat_level');
                var newLevel = changed ?
                               changed.stat_level :
                               previousLevel;
                var models = filter.datastore.models.sort(function ( a, b ) {
                    var _a = a.get('stat_level');
                    var _b = b.get('stat_level');
                    if ( _a > _b ) {
                        return -1;
                    }
                    if ( _a < _b ) {
                        return 1;
                    }
                    return 0;
                }).reduce(function ( array, model ) {
                    if ( model.id !== id || previousLevel > newLevel ) {
                        array.push(model);
                    }
                    return array;
                }, []);
                _handleSTAT(filter, models, data, id);
            }
            changed = changed || data;
            var fields = Object.keys(changed);
            var changeGrid = initChangeGrid(filter, $(filter.options.gridelementid));
            var formatters = new Formatter(id, data, changeGrid);
            var cells = [];
            var i = 0;
            var count = fields.length;
            var field, value, changer, result;
            for ( ; i < count; ++i ) {
                field = fields[ i ];
                value = changed[ field ];
                changer = formatters[ field ];
                result = typeof changer === 'function' ?
                         changer(value) :
                         formatters.anything_else(value, field);
                cells = cells.concat(result);
            }
            formatters.setCell(cells);
        };

        var _setPager = function ( $tblGrid, filter, delta ) {
            var root = window.parent || window;
            if ( root.commonjs.currentStudyFilter !== filterID ) {
                return;
            }
            var total = parseInt(filter.pager.get('TotalRecords'), 10) + delta;
            filter.pager.set('TotalRecords', total);
            var $pagerEl = $('#divPager').find('#spanPagerSpan');
            $pagerEl.find('#spnTotalPage').html(filter.datastore.length);
            $pagerEl.find('#spnTotalRecords').html(total);
        };

        var _noRecordRow = function ( $tblGrid, shouldAdd ) {
            var noRecordsTR = '<tr id="tr-no-records"><td colspan="100" style="text-align: center;font-size:14px;"> No Records Found</td></tr>';
            if ( shouldAdd === true ) {
                $tblGrid.append(noRecordsTR);
            }
            else {
                $tblGrid.find('#tr-no-records').remove();
            }
        };

        var add = function ( model, collection, options ) {
            if ( options.ignoreAdd === true ) {
                return;
            }
            var filter = options.filter;
            var $tblGrid = filter.customGridTable || $(filter.options.gridelementid);
            var data = model.toJSON();
            var id = model.id;
            if ( data.record_no !== 'NEW' && ( !data.hasOwnProperty('dicom_status') || data.dicom_status === 'MM' || data.dicom_status === 'CX' ) ) {
                $tblGrid.jqGrid('addRowData', id, data);
            }
            else {
                _setPager($tblGrid, filter, 1);
                $tblGrid.find('.Highlight_NewStudy').removeClass('Highlight_NewStudy');
                $tblGrid.jqGrid('addRowData', id, data, 'first');
                $tblGrid.find('tr').eq(1).addClass('Highlight_NewStudy');
            }
            var $tbody = $tblGrid.children('tbody');
            var $rows = $tbody.children('tr');
            if ( $rows.length === 1 ) {
                _noRecordRow($tblGrid, true);
            }
            else if ( $rows.length < 4 ) {
                _noRecordRow($tblGrid, false);
            }
            applyChanges(filter, id, model);
            commonjs.setFilter(filterID, filter);
        };

        var remove = function ( model, collection, options ) {
            var filter = options.filter;
            var $tblGrid = filter.customGridTable || $(filter.options.gridelementid);
            $tblGrid.jqGrid('delRowData', model.id);
            _setPager($tblGrid, filter, -1);
            var $tbody = $tblGrid.children('tbody');
            var $rows = $tbody.children('tr');
            if ( $rows.length === 1 ) {
                _noRecordRow($tblGrid, true);
            }
            else if ( $rows.length < 4 ) {
                _noRecordRow($tblGrid, false);
            }
            commonjs.setFilter(filterID, filter);
        };

        var change = function ( model, options ) {
            var filter = options.filter;
            var data = model.toJSON();
            applyChanges(filter, model.id, model, model.changed);
            // Move QC changes to top of list
            if ( model.changed.hasOwnProperty('dicom_status') && filter.options.filterid === 'PS' && data.dicom_status !== 'MM' && data.dicom_status !== 'CX' ) {
                var $tblGrid = filter.customGridTable || $(filter.options.gridelementid);
                var $row = $tblGrid.find('#' + model.id).detach();
                var $tbody = $tblGrid.children('tbody');
                $tbody.find('tr').eq(0).after($row);
            }
            commonjs.setFilter(filterID, filter);
        };

        var invalid = function ( model, error, options ) {
            var filter = options.filter;
            filter.datastore.remove(model.cid, options);
        };

        var updateStat = function ( collection ) {
            var statCounts = collection.toJSON().reverse().reduce(function ( stats, study ) {
                var current = stats[ study.stat_level ] || 0;
                stats[ study.stat_level ] = current + 1;
                return stats;
            }, []);
            app.stat_level.forEach(function ( stat, i ) {
                var el = document.getElementById('statCount' + i);
                if ( el ) {
                    el.innerHTML = statCounts[ i ] || 0;
                }
            });
        };

        var update = function ( collection ) {
            if ( commonjs.currentStudyFilter === filterID ) {
                commonjs.socket.emit('set-studies-list-cache', {
                    'sessionIDEncoded': base64.encode(app.sessionID),
                    'studies': collection.pluck('study_id')
                });
            }
            updateStat(collection);
        };
        var sync = updateStat;

        return {
            'add': add,
            'remove': remove,
            'change': change,
            'invalid': invalid,
            'update': update,
            'sync': sync
        };
    };
});
