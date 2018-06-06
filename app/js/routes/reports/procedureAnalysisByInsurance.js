/**
 * Author  : MURALI M
 * Created : 26/APR/17
 * ----------------------------------------------------------------------
 * Copyright © EMD Systems Software Private Ltd.  All rights reserved.
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 * All other rights reserved.
 * ----------------------------------------------------------------------
 */
define([
    'jquery'
    , 'backbone'
    , 'backbonesubroute'
    , 'shared/report-utils'
    , 'views/reports/procedureAnalysisByInsurance'
],
    function ($, Backbone, SubRoute, RoutingUtils, procedureAnalysisByInsuranceView) {

        var procedureAnalysisByInsuranceRouter = Backbone.SubRoute.extend({
            routes: {
                '': 'showDefaultView'
            },

            showDefaultView: function () {
                this.initializeRouter();
                this.procedureAnalysisByInsuranceView.showForm();
            },

            initialize: function (options) {
                this.options = options;
            },

            initializeRouter: function () {
                this.options.screen = facilityModules.reportScreens.procedureanalysisbyinsurance;
                layout.initializeLayout(this);

                if (!layout.initialized) {
                    RoutingUtils.clearView(this.options.currentView);
                    this.procedureAnalysisByInsuranceView = new procedureAnalysisByInsuranceView(this.options);
                    this.options.currentView = this.procedureAnalysisByInsuranceView;
                }
            }
        });

        return procedureAnalysisByInsuranceRouter;
    });

