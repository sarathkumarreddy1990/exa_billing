'use strict';

const fsPromises = require('fs/promises');
const _ = require('lodash');
const JSZip = require('jszip');
const crypto = require('crypto');
const moment = require('moment');
const logger = require('../../../logger');
const wcb = require('../../../server/data/ahs');
const siteConfig = require('../../../server/config');
const validateClaimsData = require('../../../server/data/claim/claim-workbench');
const {
    encoder,
    processOldData,
    processClaimSegments
} = require('./encoder');

const WCB_NEW_CLAIM_TEMPLATE = siteConfig.wcbNewClaimTemplate || 'WCB_C568';
const WCB_CORRECTION_CLAIM_TEMPLATE = siteConfig.wcbCorrectionClaimTemplate || 'WCB_C570';

const wcbModule = {

    /**
     * Function used to return Validation errors in WCB Business Rules
     * @param {Object} claimData
     * @returns an array of error messages
     */
    getWCBValidationErrors: (claimData) => {
        let validationErrorMessages = [];
        let {
            exa_claim_id,
            place_of_service,
            wcb_claim_number,
            charges = [],
            patient_data: {
                phone_area_code,
                phone_number,
                patient_phn,
                birth_date,
                patient_phn_flag
            },
            practitioner_data: {
                provider_skill_code,
                fax_area_code,
                fax_number,
                billing_number
            },
            service_start_date,
            accident_date
        } = claimData || {};

        let warningMsg = '';

        if (!wcb_claim_number || !(/^\d+$/.test(wcb_claim_number)) || wcb_claim_number.length !== 7) {
            warningMsg = `${exa_claim_id} - WCB Claim number ${wcb_claim_number} is not valid. Value must have 7 numeric values!`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (charges?.some(val => !val.diagnosis_codes)) {
            warningMsg = `${exa_claim_id} - Diagnosis code details were missing. Atleast one Diagnosis code was required`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!provider_skill_code) {
            warningMsg = `${exa_claim_id} - Practitioner Skill Code was missing`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (patient_phn_flag === 'N' && patient_phn?.length !== 9) {
            warningMsg = `${exa_claim_id} - PHN value ${patient_phn} for Alberta patient is not valid!`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!phone_number || !phone_area_code) {
            warningMsg = `${exa_claim_id} - Patient Phone number ${phone_number} or Phone number area code ${phone_area_code} is missing`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!fax_number || !fax_area_code) {
            warningMsg = `${exa_claim_id} - Practitioner Fax number ${fax_number} or Fax number area code ${fax_area_code} is missing`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!accident_date || moment(accident_date).diff(birth_date, 'years') < 12) {
            warningMsg = `${exa_claim_id} -The difference between Date of injury and Date of birth must be >= 12 years`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (moment().diff(birth_date, 'years') < 12) {
            warningMsg = `${exa_claim_id} - Patient Birth date is not valid for the claim submission. Patient age must be >= 12 years`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if ((moment(service_start_date) > moment()) || moment(service_start_date) < moment(accident_date)) {
            warningMsg = `${exa_claim_id} - Service start date must be >= Date of injury`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!place_of_service || ['C', 'F', 'H'].indexOf(place_of_service) === -1) {
            warningMsg = `${exa_claim_id} - Place of service code must be one of these values ('C'- Clinic, 'F'- Facility(Non-Hospital), 'H'- Hospital)`;
            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        if (!billing_number || billing_number.length !== 8) {
            warningMsg = `${exa_claim_id} - Practitioner number ${billing_number} must not be empty and must have 8 characters`;

            logger.info(warningMsg);
            validationErrorMessages.push(warningMsg);
        }

        return validationErrorMessages;
    },

    /**
     * Encoder logic for WCB claim submission
     * @param {Object} args {
     *      companyId,
     *      claimIds,
     *      source,
     *      isAllClaims
     * }
     * @returns Object {
     *  filePath,
     *  fileName: zipFileName,
     *  fileContent: zipContent
     * }
     */
    submitClaims: async (args) => {
        let {
            companyId,
            claimIds,
            source,
        } = args || {};

        let EDI_TEMPLATE = null;

        claimIds = claimIds?.length && claimIds.split(',') || [];

        const validationResponse = {
            validationMessages: [],
        };

        // Common validation before claim submission
        let validationData = await validateClaimsData.validateEDIClaimCreation(claimIds);
        validationData = validationData?.rows?.[0] || {};

        // validation of invalid claims or frequency before claim submission
        let ahsClaimResults = await wcb.validateAhsClaim(claimIds);
        ahsClaimResults = ahsClaimResults?.rows?.[0] || {};

        const invalid_claims = ahsClaimResults?.incorrect_claims || [];
        const unique_frequency = ahsClaimResults?.unique_frequency_count || [];

        /* allowed to submit claim when claim is in any one of the following status:
            PS - Pending Submission
        */
        const excludeClaimStatus = ['PS'];

        let claimStatus = _.difference(_.uniq(validationData.claim_status), excludeClaimStatus); // removed excluded claim status to check other status availability
        // Claim validation

        if (validationData) {

            if (claimStatus.length) {
                validationResponse.validationMessages.push('All claims must be validated before submission');
            }

            if (validationData.unique_billing_method_count > 1) {
                validationResponse.validationMessages.push('Please select claims with same type of billing method');
            }

            if (validationData.invalid_claim_count > 0) {
                validationResponse.validationMessages.push('Claim date should not be greater than the current date');
            }
        }

        if (invalid_claims.length) {
            const invalidClaimIds = _.map(invalid_claims, 'id').join(',');
            validationResponse.validationMessages.push(`${invalidClaimIds} are not processed by WCB, Please correct the frequency of claims`);
        }

        if (unique_frequency.length > 1) {
            validationResponse.validationMessages.push('Please select claims of similar claim action');
        }

        if (validationResponse?.validationMessages?.length) {
            return validationResponse;
        }

        const claimData = await wcb.getClaimsData({ claimIds });

        let validationMessages = claimData.reduce((validations, claim) => {


            if (claim.charges_details?.length > 25) {
                validations.push(`Claim ${claim.claim_id} has more than 25 charges`);
            }

            if (!claim.claim_totalCharge) {
                validations.push(`Claim ${claim.claim_id} has no billable charges`);
            }

            if (claim.billing_method !== 'electronic_billing') {
                validations.push('Please select valid billing method');
            }

            return validations;
        }, []);

        if (validationMessages?.length) {
            return {
                validationMessages
            };
        }

        let invalidClaims = claimData.filter((data) => (!data.service_provider_prid) && data.claim_id) || [];
        let submission_code = '';
        let edi_file_type = '';

        if (invalidClaims.length) {
            let uniqueInvalidClaims = _.uniq(invalidClaims.map(obj => obj.claim_id)) || [];
            validationResponse.validationMessages.push(`Claim ${uniqueInvalidClaims.join(',')} does not have service provider prid`);
            return validationResponse;
        }

        if (source === 'submit' && !invalid_claims.length && unique_frequency.length === 1) {
            if (unique_frequency?.[0]?.frequency === 'corrected') {
                source = 'change';
                submission_code = 'C570';
                edi_file_type = 'can_ab_wcb_c570';
                EDI_TEMPLATE = WCB_CORRECTION_CLAIM_TEMPLATE;
            } else {
                source = 'add';
                submission_code = 'C568';
                edi_file_type = 'can_ab_wcb_c568';
                EDI_TEMPLATE = WCB_NEW_CLAIM_TEMPLATE;
            }
        }

        let templateInfo = await wcb.getWCBTemplate({ companyId, templateName: EDI_TEMPLATE });

        if (!templateInfo) {
            let error = `No WCB submission template for ${EDI_TEMPLATE} found... `;

            logger.error(error);

            return {
                err: error
            };
        }

        const chunkSize = 20;
        let output = [];
        let submissionErrors = [];

        for (let i = 0; i < claimIds.length; i += chunkSize) {
            const chunkClaims = claimIds.slice(i, i+chunkSize);

            let {
                err = null,
                validationMessages = [],
                data = [],
            } = await wcbModule.processClaimSubmission({
                ...args,
                claimIds: chunkClaims,
                submissionCode: submission_code,
                templateName: EDI_TEMPLATE,
                templateInfo: templateInfo,
                submission_file_type: edi_file_type,
                source
            });

            if (!_.isEmpty(err)) {
                logger.error(err);
                return {
                    err
                };
            }

            if (validationMessages?.length) {
                submissionErrors.push(...validationMessages);
            }

            output.push(...data);
        }

        if (submissionErrors?.length) {
            return {
                submissionErrors
            }
        }

        return await wcbModule.generateZipFile(output, submission_code);
    },

    processClaimSubmission: async (args) => {
        let errorObj = {
            flag: false,
            errMsg: null
        };
        const validationMessages = [];
        const {
            claimIds,
            submissionCode,
            templateName,
            templateInfo,
            submission_file_type,
            source,
            userId,
            companyId
        } = args || {};

        // Logic changes here as per one claim encoding in one xml file. -- Start
        let {
            err = null,
            rows = [],
            dir_path,
            created_dt,
            file_store_id
        } = await wcb.getWcbClaimsData({ claimIds, companyId, submission_code: submissionCode });

        if (err || !rows.length) {
            errorObj = {
                flag: true,
                errMsg: !rows.length && 'No data found for claim submission' || JSON.stringify(err)
            };

            return {
                err: errorObj.errMsg
            };
        }

        // WCB Business Rule validations for each claim details
        rows[0]?.claims_data?.map((data) => {
            let errorMessages = wcbModule.getWCBValidationErrors(data);

            if (errorMessages?.length) {
                validationMessages.push(...errorMessages);
            }
        });

        // throwing validation errors in claim details
        if (validationMessages?.length) {
            return {
                err: null,
                validationMessages
            };
        }

        // Encode each claims as new xml file
        let files = _.map(rows, async (data) => {
            let {
                file_name,
                batch_sequence_number,
                batch_number,
                claims_data = [],
            } = data;

            const exa_claim_ids = claims_data.map(val => val.exa_claim_id);

            try {
                let oldClaimJson = {};

                let errMsg = '';
                // verification and processing of previously submitted file for a claim
                if (templateName === WCB_CORRECTION_CLAIM_TEMPLATE) {
                    // passing old data by fetching from file.
                    oldClaimJson = await processOldData(exa_claim_ids);

                    let {
                        error = null,
                        old_data = null
                    } = oldClaimJson;

                    if (error) {
                        errorObj.flag = true;
                        errorObj.errMsg = error;
                        errMsg = `Error occured at fetching old claim details... ${JSON.stringify(error)}`;
                        return {
                            err: errorObj
                        };
                    }

                    if (!old_data.length) {
                        errMsg = `Claim # ${exa_claim_ids} was not previously submitted to WCB!`;
                        errorObj.flag = true;
                        errorObj.errMsg = errMsg;

                        return {
                            err: errorObj
                        };
                    }

                    claims_data.forEach((val, index) => {
                        val['old_claim_data'] = old_data[index];
                    });

                }

                let {
                    outXml = null,
                    errors,
                    claimsSegment
                } = await encoder(templateName, templateInfo || {}, data);

                if (!outXml || errors?.length) {
                    return {
                        err: errors
                    };
                }

                const fullPath = `${dir_path}/${file_name}`;
                await fsPromises.mkdir(dir_path, { recursive: true });
                await fsPromises.writeFile(`${fullPath}`, outXml, { 'encoding': 'utf8' });

                const statAfter = await fsPromises.stat(`${fullPath}`);
                const file_size = statAfter.size;
                const file_md5 = crypto
                    .createHash('MD5')
                    .update(outXml, 'utf8')
                    .digest('hex');

                // store each file for each encoded claim data under current batch number
                const edi_file_id = await wcb.storeFile({
                    file_name,
                    file_md5,
                    file_size,
                    file_type: submission_file_type,
                    file_store_id,
                    companyId,
                    file_path: fullPath,
                    created_dt
                });

                if (!edi_file_id) {
                    errMsg = `Error occured at storing edi file for the batch #${batch_number}`;

                    errorObj.flag = true;
                    errorObj.errMsg = errMsg;
                    return {
                        err: errorObj
                    };
                }

                let claim_details = await processClaimSegments(claimsSegment);
                let template_data = claim_details.map((obj, index) => {
                    return {
                        claim_id: exa_claim_ids[index],
                        batch_sequence_number: claims_data[index].batch_sequence_number,
                        template_data: obj
                    };
                });

                // store claims into edi_file_claims table for every claims
                const edi_file_claim_ids = await wcb.storeFileClaims({
                    edi_file_id,
                    template_data,
                    batch_number,
                    sequence_number: batch_sequence_number,
                    action_code: source || null
                });

                if (!edi_file_claim_ids) {
                    errMsg = `Error occured at storing claim ${exa_claim_ids} into edi file claims table...`;
                    errorObj.flag = true;
                    errorObj.errMsg = errMsg;

                    return {
                        err: errorObj
                    };
                }

                const fileInfo = {
                    file_size,
                    file_md5
                };

                await wcb.updateClaimsStatus({
                    claimIds: exa_claim_ids,
                    statusCode: 'PP',
                    claimNote: 'Electronic claim has been submitted to WCB',
                    userId: userId
                });

                await wcb.updateEDIFile({
                    status: 'success',
                    ediFileId: edi_file_id,
                    fileInfo
                });

                return {
                    encodedContent: outXml,
                    file_path: fullPath,
                    err: null,
                    dir_path,
                    batch_number,
                    file_name,
                };
            } catch (err) {
                errorObj.flag = true;
                errorObj.errMsg = err || null;

                logger.error(`Error occured while submitting the claims ${err}`);
                return {
                    err: errorObj
                };
            }
        });

        let data = await Promise.all(files);

        if (errorObj.flag) {
            logger.error(errorObj.errMsg);

            return {
                err: errorObj.errMsg
            };
        }

        return {
            dir_path,
            data: data?.filter(obj => !_.isEmpty(obj?.encodedContent)) || []
        };
    },

    generateZipFile: async (filesList, submission_code) => {
        let errMsg = '';
        const dir_path = filesList?.[0]?.dir_path || null;
        try {
            // writing the xml files into zip file
            const zip = new JSZip();
            await filesList.map(function (obj) {
                return zip.file(obj.file_name, obj.encodedContent);
            });

            let zipContent = '';
            let zipFileName = `${submission_code}${moment().format('YYYYMMDDHHmmssmsSSS')}.zip`;
            let outputFilePath = `${dir_path}/${zipFileName}`;

            // generating the zip file
            zipContent = await zip.generateAsync({ type: "base64", streamFiles: true });
            await fsPromises.writeFile(outputFilePath, zipContent, { encoding: 'utf-8' });

            return {
                filePath: outputFilePath,
                fileName: zipFileName,
                fileContent: zipContent
            };

        } catch (err) {
            errMsg = `Error occured while archiving/writing the zip files - ${err}`;
            logger.error(errMsg);

            return {
                err: errMsg
            };
        }
    }
};

module.exports = wcbModule;
