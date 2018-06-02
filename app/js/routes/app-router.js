define([
    'backbone',
    'views/worklist',
    'views/studies',
    'views/claim-workbench',
    'routes/app/index',
    'routes/setup/index',
    'modules/reporting/routes/index',   
    'modules/reporting/views/billing/charges',
    'modules/reporting/views/billing/payments',
    'modules/reporting/views/billing/claim-activity',
    'modules/reporting/views/billing/claim-inquiry',
    'modules/reporting/views/billing/patient-statement',
    'modules/reporting/views/billing/modality-summary',
    'modules/reporting/views/billing/payer-mix',
    'modules/reporting/views/billing/payments-by-ins-company',
    'modules/reporting/views/billing/referring-provider-count',
    'modules/reporting/views/billing/referring-provider-summary',
    'modules/reporting/views/billing/transaction-summary',
    'modules/reporting/views/billing/date-of-SVC-payment-summary',
    'modules/reporting/views/billing/diagnosis-count',
    'views/app/payments',
    'views/app/payment-edit'
], function (Backbone,
    WorklistView,
    StudiesView,
    ClaimWorkBenchView,
    AppRoute,
    SetupRoute,
    ReportRoute,
    ChargeReportView,   
    PaymentReportView,   
    ClaimActivityView, 
    ClaimInquiryView, 
    PatientStatementView, 
    MoadalitySummaryView, 
    PayerMixView,
    PaymentByInsCompanyView,
    ReferringProviderCountView,
    ReferringProviderSummaryView,
    TransactionSummaryView,
    DateOfSVCSummaryView,
    DiagnosisCountView,
    PaymentsView,
    EditPaymentView
    ) {
        var AppRouter = Backbone.Router.extend({
            routes: {
                "app/worklist": "startApp",
                "app/reports": "startReporting",
                "app/studies": "startAppStudies",
                "app/claim_workbench": "startClaimWorkBench",               
                "app/reports/charges": "startChargeReporting",               
                "app/reports/payments": "startPaymentReporting",               
                "app/reports/claim-activity": "startClaimActivityReporting",
                "app/reports/claim-inquiry": "startClaimInquiryReporting",
                "app/reports/patient-statement": "startPatientStatementReporting",
                "app/reports/modality-summary": "startModalitySummaryReporting",           
                "app/reports/payer-mix": "startPayerMixReporting",
                "app/reports/payments-by-ins-company": "startPaymentsByInsuranceCompanyReporting",
                "app/reports/referring-provider-count": "startReferringProviderCountReporting",
                "app/reports/referring-provider-summary": "startReferringProviderSummaryReporting",
                "app/reports/transaction-summary": "starttransactionSummaryReporting",
                "app/reports/date-of-SVC-payment-summary": "startDateOfSVCSummaryViewReporting",
                "app/reports/diagnosis-count": "startDiagnosisCountReporting",
    
                // "app/*subroute": "startApp",
                "setup/*subroute": "startSetup",
                "app/payments": "startPayments",
                "app/payments/edit/:id": "editPayment",
                "reports/*subroute": "startReport"
            },
            // startApp: function (subroutes) {
            //     if (!this.appRoute) {
            //         this.appRoute = new WorklistView({ el: $('#root') });
            //     }
            // },
            startApp: function (subroute) {
                if (!this.appRouter) {
                    this.appRouter = new AppRoute("app/", { createTrailingSlashRoutes: true });
                }
            },
            startSetup: function (subroute) {
                if (!this.setupRouter) {
                    this.setupRouter = new SetupRoute("setup/", { createTrailingSlashRoutes: true });
                }
            },
            startReport : function (subroute) {
                if (!this.reportingRouter) {                  
                    this.reportingRouter = new ReportRoute("reports/", { createTrailingSlashRoutes: true } );
                }
            },
            startAppStudies: function (subroutes) {
                if (!this.appRoute) {
                    this.appRoute = new StudiesView({ el: $('#root') });
                }
            },
            startClaimWorkBench: function (subroutes) {
                if (!this.appClaimWorkBenchRoute) {
                    this.appClaimWorkBenchRoute = new ClaimWorkBenchView({ el: $('#root') });
                }
            },           
    
            startChargeReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ChargeReportView({ el: $('#root') });
                }
            },   

            startPaymentReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentReportView({ el: $('#root') });
                }
            },    

            startPaymentReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentReportView({ el: $('#root') });
                }
            },    
          
            startClaimActivityReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ClaimActivityView({ el: $('#root') });
                }
            },

            startClaimInquiryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ClaimInquiryView({ el: $('#root') });
                }
            },

            startPatientStatementReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PatientStatementView({ el: $('#root') });
                }
            },

            startModalitySummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new MoadalitySummaryView({ el: $('#root') });
                }
            }, 

            startPayerMixReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PayerMixView({ el: $('#root') });
                }
            },
            
            startPaymentsByInsuranceCompanyReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new PaymentByInsCompanyView({ el: $('#root') });
                }
            },  

            startReferringProviderCountReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ReferringProviderCountView({ el: $('#root') });
                }
            },

            startReferringProviderSummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new ReferringProviderSummaryView({ el: $('#root') });
                }
            },

            starttransactionSummaryReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new TransactionSummaryView({ el: $('#root') });
                }
            },

            startDateOfSVCSummaryViewReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new DateOfSVCSummaryView({ el: $('#root') });
                }
            },

            startDiagnosisCountReporting: function (subroutes) {
                if (!this.reportingRoute) {             
                    this.reportingRoute = new DiagnosisCountView({ el: $('#root') });
                }
            },

            startPayments: function (subroutes) {
                if (!this.appRoute) {
                    this.appRoute = new PaymentsView({ el: $('#root') });
                }
            },

            editPayment: function (paymentId) {
                if (!this.appRoute) {
                    this.appRoute = new EditPaymentView({ el: $('#root'), id: paymentId });
                }
            },

            initialize: function () {
                $('#initialLoading').hide();
                $('#root-content').show();
            }
        });
        return {
            initialize: function () {
                new AppRouter();
                Backbone.history.start();
            }
        };
    });