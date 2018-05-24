define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid',
    'jqgridlocale',
    'models/pager',
    'text!templates/worklist.html'
], function (
    $,
    _,
    Backbone,
    JGrid,
    JGridLocale,
    Pager,
    WorklistTemplate) {
        return Backbone.View.extend({
            el: null,
            pager: null,

            template: _.template(WorklistTemplate),

            events: {
            },

            initialize: function () {
                $(this.el).html(this.template());

                var data = [{ 'facility_code': 'F00', 'facility_name': 'Test Office' }];

                this.pager = new Pager();
                this.testTable = new customGrid();
                this.testTable.render({
                    gridelementid: '#tblGridTest',
                    custompager: this.pager,
                    emptyMessage: 'No Record found',
                    colNames: ['', ''],
                    i18nNames: ['setup.facility.code', 'shared.fields.name'],
                    colModel: [
                        { name: 'facility_code', width: 465, searchFlag: '%', defaultValue: '2' },
                        { name: 'facility_name', width: 465, searchFlag: '%', defaultValue: '10' }
                    ],
                    pager: '#gridPager_Test',
                    sortname: "facility_code",
                    sortorder: "asc",
                    datastore: data,
                    container: this.el,
                    disablesearch: false,
                    disablesort: false,
                    disablepaging: false,
                    disableadd: true,
                    disablereload: true,
                    showcaption: false,
                    customizeSort: true
                });

                // for (var i = 0; i < data.length; i++) {
                //   $("#tblGridTest").jqGrid('addRowData', i + 1, data[i]);
                // }
            }
        });
    });
