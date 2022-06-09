'use strict';
const xmlParser = require('xml2js').parseString;
const logger = require('../../../logger');

const wcbParser = {
    getWCBData: async (fileData) => {
        let data = {};
        xmlParser(fileData, { explicitArray: false }, (err, result) => {
            if (err) {
                logger.error(err);
                return data = err;
            };

            let {
                PaymentRemittanceReport: {
                    PaymentRemittanceRecord,
                    OverpaymentRemittanceRecord
                }
            } = result || {};

            data = {
                payment_remittance: PaymentRemittanceRecord && !Array.isArray(PaymentRemittanceRecord)
                    ? [PaymentRemittanceRecord]
                    : PaymentRemittanceRecord,
                overpayment_remittance: OverpaymentRemittanceRecord && !Array.isArray(OverpaymentRemittanceRecord)
                    ? [OverpaymentRemittanceRecord]
                    : OverpaymentRemittanceRecord
            };
        });
        return data;
    }
};

module.exports = wcbParser;