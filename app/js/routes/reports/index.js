define([
    'backbone',
    'backbonesubroute',
    'views/reports/index',
    'text!templates/access-denied.html',
    'routes/reports/charges',
    'routes/reports/claim-activity',
    'routes/reports/claim-inquiry',
    'routes/reports/payment-report',
    'routes/reports/patient-statement',
    'routes/reports/modality-summary',
    'routes/reports/payer-mix',
    'routes/reports/payments-by-ins-company',
    'routes/reports/referring-provider-count',
    'routes/reports/referring-provider-summary',
    'routes/reports/transaction-summary',
    'routes/reports/date-of-SVC-payment-summary',
    'routes/reports/diagnosis-count',
    'routes/reports/patients-by-insurance-company',
    'routes/reports/procedure-count',
    'routes/reports/reading-provider-fees',
    'routes/reports/monthly-recap',
    'routes/reports/claim-transaction',
    'routes/reports/procedure-analysis-by-insurance',
    'routes/reports/credit-balance-encounters',
    'routes/reports/aged-ar-summary',
    'routes/reports/aged-ar-details',
    'routes/reports/insurance-vs-lop',
    'routes/reports/payments-realization-rate-analysis'
], function (
    Backbone,
    BackboneSubroute,
    ReportView,
    AccessDeniedTemplate,
    ChargeReportRoute,
    ClaimActivityReportRoute,
    ClaimInquiryReportRoute,
    PaymentReportRoute,
    PatientStatementRoute,
    MoadalitySummaryRoute,
    PayerMixRoute,
    PaymentByInsCompanyRoute,
    ReferringProviderCountRoute,
    ReferringProviderSummaryRoute,
    TransactionSummaryRoute,
    DateOfSVCSummaryRoute,
    DiagnosisCountRoute,
    PatientsByInsuranceCompanyRoute,
    ProcedureCountRoute,
    ReadingProviderFeesRoute,
    MonthlyRecapRoute,
    ClaimTransactionRoute,
    ProcedureAnalysisByInsuranceRoute,
    CreditBalanceEncountersRoute,
    AgedArSummaryRoute,
    AgedArDetailsRoute,
    InsuranceVSLopRoute,
    PaymentsRealizationRateAnalysisRoute
) {
        return Backbone.SubRoute.extend({
            routes: {
                "r/charges": "startChargesReport",
                "r/claim-activity": "startClaimActivityReport",
                "r/claim-inquiry": "startClaimInquiryReport",
                "r/payment-report": "startPaymentReporting",
                "r/patient-statement": "startPatientStatementReporting",
                "r/modality-summary": "startModalitySummaryReporting",
                "r/payer-mix": "startPayerMixReporting",
                "r/payments-by-ins-company": "startPaymentsByInsuranceCompanyReporting",
                "r/referring-provider-count": "startReferringProviderCountReporting",
                "r/referring-provider-summary": "startReferringProviderSummaryReporting",
                "r/transaction-summary": "starttransactionSummaryReporting",
                "r/date-of-SVC-payment-summary": "startDateOfSVCSummaryViewReporting",
                "r/diagnosis-count": "startDiagnosisCountReporting",
                "r/patients-by-insurance-company": "startPatientsByInsuranceCompanyViewReporting",
                "r/procedure-count": "startProcedureCountViewReporting",
                "r/reading-provider-fees": "startReadingProviderFeesReporting",
                "r/monthly-recap": "startMonthlyRecapReporting",
                "r/claim-transaction": "startClaimTransactionReporting",
                "r/procedure-analysis-by-insurance": "startProcedureAnalysisByInsuranceReporting",
                "r/credit-balance-encounters": "startCreditBalanceEncountersReporting",
                "r/aged-ar-summary": "startAgedARSummaryReporting",
                "r/aged-ar-details": "startAgedARDetailsReporting",
                "r/insurance-vs-lop": "startInsuranceVSLopReporting",
                "r/payments-realization-rate-analysis" : "startPaymentsRealizationRateAnalysisReporting"
            },

            accessDeniedTemplate: _.template(AccessDeniedTemplate),

            defaultArgs: {
                //createTrailingSlashRoutes: true, layout: siteLayouts.report, outerLayout: null, module: facilityModules.report, screen: null, el: '#data_container', routePrefix: null
                createTrailingSlashRoutes: true, layout: 'report', outerLayout: null, module: 'report', screen: null, el: '#data_container', routePrefix: null
            },

            accessDenied: function () {
                var self = this;
                $("#data_container").html(self.accessDeniedTemplate);
                $("#divPageHeaderButtons").html("");
            },

            startChargesReport: function (subroute) {
                if (this.checkLicense('Charges') && !this.chargesRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.chargesRouter = new ChargeReportRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startClaimActivityReport: function (subroute) {
                if (this.checkLicense('Claim Activity') && !this.claimActivityRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.claimActivityRouter = new ClaimActivityReportRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startClaimInquiryReport: function (subroute) {
                if (this.checkLicense('Claim Inquiry') && !this.claimInquiryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.claimInquiryRouter = new ClaimInquiryReportRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPaymentReporting: function (subroute) {
                if (this.checkLicense('Payments') && !this.paymentRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.paymentRouter = new PaymentReportRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPatientStatementReporting: function (subroute) {
                if (this.checkLicense('Patient Statement') && !this.patientStatementRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.patientStatementRouter = new PatientStatementRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startModalitySummaryReporting: function (subroute) {
                if (this.checkLicense('Modality Summary') && !this.modalitySummaryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.modalitySummaryRouter = new MoadalitySummaryRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPayerMixReporting: function (subroute) {
                if (this.checkLicense('Payer Mix') && !this.payerMixtRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.payerMixtRouter = new PayerMixRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPaymentsByInsuranceCompanyReporting: function (subroute) {
                if (this.checkLicense('Payments By Ins Company') && !this.paymentsByInsuranceComapanyRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.paymentsByInsuranceComapanyRouter = new PaymentByInsCompanyRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startReferringProviderCountReporting: function (subroute) {
                if (this.checkLicense('Referring Provider Count') && !this.referringProCountRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.referringProCountRouter = new ReferringProviderCountRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startReferringProviderSummaryReporting: function (subroute) {
                if (this.checkLicense('Referring Provider Summary') && !this.referringProSummaryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.referringProSummaryRouter = new ReferringProviderSummaryRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            starttransactionSummaryReporting: function (subroute) {
                if (this.checkLicense('Transaction Summary') && !this.transactionSummaryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.transactionSummaryRouter = new TransactionSummaryRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startDateOfSVCSummaryViewReporting: function (subroute) {
                if (this.checkLicense('Date Of SVC Summary') && !this.dateOfSVCSummaryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.dateOfSVCSummaryRouter = new DateOfSVCSummaryRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startDiagnosisCountReporting: function (subroute) {
                if (this.checkLicense('Diagnosis Count') && !this.diagnosisCountRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.diagnosisCountRouter = new DiagnosisCountRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPatientsByInsuranceCompanyViewReporting: function (subroute) {
                if (this.checkLicense('Patients By Insurance Company') && !this.patientsByInsCompanyRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.patientsByInsCompanyRouter = new PatientsByInsuranceCompanyRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startProcedureCountViewReporting: function (subroute) {
                if (this.checkLicense('Procedure Count') && !this.procedureCountRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.procedureCountRouter = new ProcedureCountRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startReadingProviderFeesReporting: function (subroute) {
                if (this.checkLicense('Reading Provider Fees') && !this.readingProviderFeesRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.readingProviderFeesRouter = new ReadingProviderFeesRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startMonthlyRecapReporting: function (subroute) {
                if (this.checkLicense('Monthly Recap') && !this.monthlyRecapRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.monthlyRecapRouter = new MonthlyRecapRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startClaimTransactionReporting: function (subroute) {
                if (this.checkLicense('Claim Trancation') && !this.claimTrancationRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.claimTrancationRouter = new ClaimTransactionRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startProcedureAnalysisByInsuranceReporting: function (subroute) {
                if (this.checkLicense('Procedure Analysis By Insurance') && !this.procedureAnalysisByInsuranceRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.procedureAnalysisByInsuranceRouter = new ProcedureAnalysisByInsuranceRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startCreditBalanceEncountersReporting: function (subroute) {
                if (this.checkLicense('Credit Balance Encounters') && !this.creditBalanceEncounterRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.creditBalanceEncounterRouter = new CreditBalanceEncountersRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startAgedARSummaryReporting: function (subroute) {
                if (this.checkLicense('Aged AR Summary') && !this.agedARSummaryRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.agedARSummaryRouter = new AgedArSummaryRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startAgedARDetailsReporting: function (subroute) {
                if (this.checkLicense('Aged AR Details') && !this.agedARDetailsRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.agedARDetailsRouter = new AgedArDetailsRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startInsuranceVSLopReporting: function (subroute) {
                if (this.checkLicense('Insurance VS LOP') && !this.insuranceVsLOPRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.insuranceVsLOPRouter = new InsuranceVSLopRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            startPaymentsRealizationRateAnalysisReporting: function (subroute) {
                if (this.checkLicense('Payments Realization Rate Analysis') && !this.paymentsRealizationRateAnalysisRouter) {
                    this.defaultArgs.routePrefix = 'reports/r/';
                    this.paymentsRealizationRateAnalysisRouter = new PaymentsRealizationRateAnalysisRoute(this.defaultArgs.routePrefix, this.defaultArgs);
                } else {
                    this.accessDenied();
                }
            },

            initialize: function () {
                //this.options = options;
                if (!this.reportView) {
                    this.reportView = new ReportView({ el: $('#root') });
                    this.defaultArgs.outerLayout = this.reportView;
                }
            },

            checkLicense: function (currentScreen) {
                //return layout.checkLicense(currentScreen);
                return true;
            },
        });
    });
