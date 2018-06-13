define(['jquery', 'immutable', 'underscore', 'backbone', 'jqgrid', 'jqgridlocale', 'text!templates/app/eraGrid.html', 'collections/app/era', 'models/pager'],
    function (jQuery, Immutable, _, Backbone, JGrid, JGridLocale, eraGrid, eraLists, EobFilesPager) {
        var eraView = Backbone.View.extend({

            eraGridTemplate: _.template(eraGrid),
            subGridFilesTable: null,
            subGridPager: null,
            eobStatus: {"": "All", "P": "Pending", "IP": "In Progress", "S": "Success", "RP": "Ready for Processing"},
            parent_file_id: 0,

            events: {
                'click #btnProcessERA': 'processERAFile',
                'click #btnReloadERA': 'reloadERAFiles',
                'click #btnReloadERALocal': 'reloadERAFilesLocal',
                'change #myFile': 'processSelectedERAFile'
            },

            initialize: function ( options ) {
                this.options = options;
                var _self = this;
                this.pager = new EobFilesPager();
                this.eraLists = new eraLists();
                app.fileStoreId = 1;
                app.settings.eraInboxPath = 'D:eraInbox';
            },
            
            showGrid: function () {
                var self = this;
                commonjs.showLoading();
                $(this.el).html(this.eraGridTemplate());
                self.getEobFilesList();
                commonjs.initializeScreen({header: {screen: 'ERA', ext: 'eob'}});
                commonjs.hideLoading();
            },

            reloadERAFilesLocal: function () {
                this.pager.set({"PageNo": 1});
                $('.ui-jqgrid-htable:visible').find('input, select').val('');
                this.eobFilesTable.refresh();
            },
            
            getEobFilesList: function () {
                var self = this;
                var offsetHeight = (commonjs.currentModule == "Setup") ? '30' : '0';
                this.eobFilesTable = new customGrid();
                this.eobFilesTable.render({
                    gridelementid: '#tblEOBFileList',
                    custompager: this.pager,
                    emptyMessage: 'No Record found',
                    colNames: ['', '', '', 'File Name', 'Size', 'File Updated Date/Time', 'Status'],
                    i18nNames: ['', '', 'home.pendingStudies.fileName', 'home.viewerCommonOptions.size', 'home.pendingStudies.fileUpdatedDateTime', 'shared.fields.status'],
                    colModel: [
                        { name: 'id', index: 'id', key: true, hidden: true, searchFlag: '%', search: false },
                        { name: 'file_store_id', hidden: true, searchFlag: '%', search: false },
                        {
                            name: 'edit', width: 20, sortable: false, search: false,
                            formatter: function (cellvalue, options, rowObject) {
                                return '<input type="radio" class="studyChk" name="chkStudy" id="' + rowObject.id + '" />'
                            }
                        },
                        { name: 'file_name', width: 600, searchFlag: 'hstore', searchoptions: {defaultValue: commonjs.filterData['file_name']}},
                        { name: 'size', width: 200, searchFlag: 'hstore', searchoptions: {defaultValue: commonjs.filterData['size']}, formatter: function (cellvalue, options, rowObject) {
                            return self.fileSizeTypeFormatter(cellvalue, options, rowObject);
                        }},
                        { name: 'updated_date_time', width: 200, searchFlag: 'hstore', searchoptions: {defaultValue: commonjs.filterData['updated_date_time']}, formatter: function (cellvalue, options, rowObject) {
                            return self.fileUpdatedDateFormatter(cellvalue, options, rowObject);
                        }},
                        { name: 'current_status', width: 200, stype: 'select',
                            searchoptions: { value: self.eobStatus, defaultValue: commonjs.filterData['current_status']},
                            edittype: 'select', editoptions: { value: self.eobStatus},
                            cellattr: function (rowId, value, rowObject, colModel, arrData) {
                                return 'style=text-transform: capitalize;'
                            }
                        }
                    ],
                    pager: '#gridPager_EOBFileList',
                    customizeSort: true,
                    sortname: "updated_date_time",
                    sortorder: "DESC",
                    caption: "EOB Files",
                    datastore: this.eraLists,
                    container: this.el,
                    dblClickActionIndex: 0,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    showcaption: false,
                    disableadd: true,
                    disablereload: true,
                    offsetHeight: offsetHeight,
                    disableautoheightresize: true,
                    height: $('#body_content').height() - 220,
                    customargs: {
                        showParentFileOnly: true,
                        companyID: app.companyID
                    }
                });
            },

            fileUpdatedDateFormatter: function (cellvalue, options, rowObject) {
                return rowObject.updated_date_time ? moment(rowObject.updated_date_time).format('L, h:mm a') : ''
            },
            
            fileSizeTypeFormatter: function (cellvalue, options, rowObject) {
                var i = parseInt(Math.floor(Math.log(rowObject.size) / Math.log(1024)));
                var sizes = ['Bytes', 'KB'];
                return Math.round(rowObject.size / Math.pow(1024, i), 2) + ' ' + sizes[i];
            },

            eobStatusFormatter: function (cellvalue, options, rowObject) {
                return rowObject.updated_date_time ? moment(rowObject.updated_date_time).format('L, h:mm a') : ''
            },
            
            reloadERAFiles: function () {
                commonjs.filterData = {};
                var iframeObj = document.getElementById("ifrEobFileUpload") && document.getElementById("ifrEobFileUpload").contentWindow ? document.getElementById("ifrEobFileUpload").contentWindow : null;
                var inputObj = document.getElementById("ifrEobFileUpload").contentWindow.document.getElementById('eraFile');
                if (!app.settings.eraInboxPath) {
                    inputObj.disabled = true;
                    commonjs.showWarning('ERA Inbox path not yet set.', '', true);
                }
                else {
                     if (inputObj.getAttribute('data-isDuplicate') == 'true')
                        commonjs.showWarning('File already processed');
                    else {
                        this.pager.set({"PageNo": 1});
                        $('.ui-jqgrid-htable:visible').find('input, select').val('');
                        if (inputObj.getAttribute('data-uploaded') == 'true') {
                            this.eobFilesTable.refresh();
                        }
                        else
                            this.eobFilesTable.refreshAll();
                        inputObj.setAttribute('data-isDuplicate', '');
                    }
                    if (iframeObj && inputObj) {
                        inputObj.style.display = 'block'
                        inputObj.value = '';
                    }
                    inputObj.setAttribute('data-isDuplicate', '');
                }
            }

        });
        return eraView;
    });