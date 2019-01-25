

/**
 * const JSONExtractor - responsible for mapping the JSON data returned by the
 * EXA Billing 1.5 query to the field names known by OHIP. The data supplied to
 * each of the methods should be an entire claim within the array of claims
 * returned by the EXA Billing 1.5 query [{claim1...}, {claim2...}, ...]
 *
 * @param  {type} options runtime extractor options
 * @return {type}         an object capable of extracting selective JSON data
 */
const JSONExtractor = function(data) {

    let mappedData = data.reduce((batch, currentGroup) => {

        let billingProviderNPI = currentGroup.billingProvider.npiNo;
        let renderingProviderNPI = null;
        let subscriberClaims = [];

        currentGroup.subscriber.forEach((subscriber) => {

            console.log('JAQUA', subscriber.claim);
            subscriber.claim.forEach((subscriberClaim) => {


                renderingProviderNPI = '01234533';//subscriberClaim.renderingProvider[0].NPINO;
                // console.log('rendering provider number: ' + renderingProviderNPI);

                let claim = {
                    // for claim header-1
                    healthNumber: subscriber.policyNo.substr(0,10),
                    versionCode: subscriber.policyNo.substr(10,2),
                    dateOfBirth: subscriber.dob,
                    accountingNumber: subscriberClaim.claimNumber,
                    paymentProgram: subscriber.payer.payerID,
                    payee: subscriber.acceptAssignment ? 'P' : 'S',
                    masterNumber: currentGroup.billingProvider.federalTaxID,
                    inpatientAdmissionDate: '',      // TODO,
                    referringProviderNumber: subscriberClaim.referringProvider[0].NPINO,
                    manualReviewIndicator: '',      // TODO
                    serviceLocationIndicator: '',   // TODO

                    // for claim header-2
                    registrationNumber: '',
                    patientLastName: subscriber.lastName,
                    patientFirstName: subscriber.firstName,
                    patientSex: subscriber.gender,
                    provinceCode: subscriber.state,

                    items: [],
                };

                subscriberClaim.serviceLine.forEach((claimService) => {
                    let item = {
                        serviceCode: claimService.examCpt,
                        feeSubmitted: claimService.totalBillFee,
                        numberOfServices: claimService.unit,
                        serviceDate: claimService.studyDt,
                        diagnosticCode: ''  // TODO
                    };
                    claim.items.push(item);
                });

                subscriberClaims.push(claim);
            });
        });

        let mappedGroup = batch.find((group) => {
            return group.groupNumber === billingProviderNPI
                && group.providerNumber === renderingProviderNPI;
        });

        if (!mappedGroup) {
            mappedGroup = {
                groupNumber: billingProviderNPI,
                providerNumber: renderingProviderNPI.substr(0, 6),
                specialtyCode: renderingProviderNPI.substr(6, 2),
                claims: [],
            };
            batch.push(mappedGroup); // now it exists ;)
        }

        mappedGroup.claims = mappedGroup.claims.concat(subscriberClaims);

        // console.log("subcriber: " + JSON.stringify(currentGroup.subscriber));
        return batch;
    }, []);

    // console.log("MAPPED DATA: " + JSON.stringify(mappedData));

    return {
        getMappedData: () => {
            return mappedData;
        },
    };
};

module.exports = JSONExtractor;
