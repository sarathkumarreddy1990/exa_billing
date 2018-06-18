define([
    'jquery',
    'underscore',
    'backbone',
    'jqgrid', 'jqgridlocale',
    'text!templates/app/studies.html',
]
    , function (
        $,
        _,
        Backbone,
        JQGrid,
        JGridLocale,
        StudiesGrid,
    ) {
        var StudiesView = Backbone.View.extend({
            el: null,
            pager: null,
            model: null,
            studiesGrid: _.template(StudiesGrid),

            events: {
            },

            initialize: function (options) {
                this.options = options;
                // this.pager = new ModelIcdPager();
                // this.model = new ModelIcdCode();
                // this.icdList = new IcdList();
                // commonjs.activatelink('Scheduling & Codes');
            },

            render: function () {
                $(this.el).html(this.studiesGrid());
            },

            showGrid: function () {
                this.render();
            },
        });

        return StudiesView;
    });
