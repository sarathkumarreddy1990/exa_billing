'use strict';
const _ = require('lodash');
const builder = require('xmlbuilder');
const fsPromises = require('fs/promises');
const path = require('path');
const { XML_ELEMENTS } = require('./constants');
const xmlParser = require('xml2js').parseString;
const {
    isArray,
    getFormattedValue
} = require('../util');
const logger = require('../../../../logger');

const {
    XML_ROOT,
    FILE_HEADER,
    FILE_TRAILER,
    CONTENT_NODE,
    ATTACHMENT_SEGMENT,
    INVOICE_LINE_SEGMENT,
    ICD_POB_SEGMENT,
    ICD_LST_SEGMENT,
    ICD_CODE_SEGMENT,
    FEE_MODIFIER_SEGMENT,
    NAMESPACE,
    XMLSCHEMA_INSTANCE,
    XMLSCHEMA_INSTANCE_LOCATION,
    WCB_CORRECTION_CLAIM_TEMPLATE,
    CONTENT_GRP_4,
    CONTENT_LST_5,
    CONTENT_GRP_3,
    CONTENT_GRP_2,
    CONTENT_LST_3,
    CONTENT_GRP_1,
    CONTENT_LST_1,
    INVOICE_TYPE_CODE,
    TRANSACTION_CODE,
    TRANSACTION_DESCRIPTION
} = XML_ELEMENTS;

/**
 * Used to return the array of keys in object
 * @param {Object} input 
 * @returns Array of keys in object
 */
const getObjKeys = (input) => {
    return input && typeof input === 'object' && Object.keys(input) || [];
};

/**
 * Used to replace the values of template variables in Array of Object
 * @param {String} node 
 * @param {Object} templateJson 
 * @param {Object} data 
 * @param {String} templateName 
 * @returns Formatted JSON object with replaced values
 */
const bindArrayJson = (node, templateJson, data, templateName) => {
    let outputJson = [];
    let arrData = [];
    let isCorrectionTemplate = templateName === WCB_CORRECTION_CLAIM_TEMPLATE;
    let singleTemplateJson = !_.isEmpty(templateJson) && templateJson[0] || {};
    let keysOrder = _.get(singleTemplateJson, "ORDER");

    switch (node) {
        case ICD_POB_SEGMENT:
            let icdArr = data?.diagnosis_codes || [];
            let pobArr = data?.orientation || [];

            for (let i = 0; i < icdArr.length; i++) {
                keysOrder = keysOrder || getObjKeys(singleTemplateJson);
                outputJson.push(createNode(node, singleTemplateJson, keysOrder, icdArr[i], templateName) || null);
            }

            if (!isCorrectionTemplate) {
                for (let j = 0; j < pobArr.length; j++) { // loop over each part of body from database
                    for (let k = 1; k <= 3; k++) { // loop over part of body, side of body and nature of injury combinations
                        keysOrder = keysOrder || getObjKeys(templateJson[k]);
                        outputJson.push(createNode(node, templateJson[k], keysOrder, pobArr[j], templateName) || null);
                    }
                }
            }

            break;
        case FEE_MODIFIER_SEGMENT:
            arrData = data?.fee_modifiers || [];

            for (let i = 0; i < arrData.length; i++) {
                keysOrder = keysOrder || getObjKeys(singleTemplateJson);
                outputJson.push(createNode(node, singleTemplateJson, keysOrder, { 'fee_modifiers': arrData[i] }, templateName) || null);
            }

            break;
        case INVOICE_LINE_SEGMENT:
            arrData = templateJson || [];

            for (let i = 0; i < arrData.length; i++) {
                keysOrder = keysOrder || getObjKeys(arrData[i]);

                outputJson.push(
                    isCorrectionTemplate && i % 2 === 0
                        ? data.old_claim_data  // read old claim details from previously submitted file data
                        : createNode(node, arrData[i], keysOrder, data, templateName) || null
                );
            }

            break;
        case ATTACHMENT_SEGMENT:
            let attachments = data?.attachments || [];
            let mandatoryFieldsCount = isCorrectionTemplate ? 3 : 4;
            let templateLength = templateJson.length;

            for (let i = 0; i < mandatoryFieldsCount; i++) {
                if (_.get(templateJson[i], "ORDER")) {
                    continue;
                }

                keysOrder = keysOrder || getObjKeys(templateJson[i]);
                outputJson.push(createNode(node, templateJson[i], keysOrder, data, templateName) || null);
            }

            if (!isCorrectionTemplate) {
                for (let j = 0; j < attachments.length; j++) {
                    let details = _.isEmpty(attachments[j])
                        ? {}
                        : {
                            ...attachments[j],
                            'attachment_name_header': `FILEATTACHMENTNAME${j + 1}`,
                            'attachment_type_header': `FILEATTACHMENTREPORTTYPE${j + 1}`,
                            'attachment_content_header': `FILEATTACHMENTCONTENT${j + 1}`,
                            'attachment_description_header': `FILEATTACHMENTDESCRIPTION${j + 1}`
                        };

                    for (let k = mandatoryFieldsCount; k < templateLength; k++) {
                        if (_.get(templateJson[k], "ORDER")) {
                            continue;
                        }

                        keysOrder = keysOrder || getObjKeys(templateJson[k]);
                        outputJson.push(createNode(node, templateJson[k], keysOrder, details, templateName) || null);
                    }
                }
            }

            break;
    }

    return outputJson || [];
};

/**
 * Used to replace the single template string with the given input value
 * @param {String} input 
 * @param {Object} data 
 * @returns a Formatted value for the single template variable
 */
const bindString = (input, data) => {
    let output = {};

    if (input && (typeof input == 'string') && input.startsWith('$') && input.endsWith('}')) {

        // replacing template variables with actual data
        let stringToReplace = input.replace(/\$|{|}/g, '');
        let inputArr = stringToReplace.split('.');

        let obj = data;

        if (inputArr.length > 1) {
            for (let j = 0; j < inputArr.length; j++) {
                obj = getFormattedValue(inputArr[j], obj);
            }
        } else {
            obj = getFormattedValue(inputArr[0], data);
        }
        output = obj || '';
    } else {
        output = input || '';
    }

    return output;
};

/**
 * Used to replace the values of template variables in Single Object
 * @param {Object} templateJson 
 * @param {Array} keysOrder 
 * @param {Object} data 
 * @param {Object} outputJson 
 * @param {String} templateName 
 * @returns Single object with template variables replaced by the input data
 */
const bindSingleJson = (templateJson, keysOrder, data, outputJson, templateName) => {
    if (!outputJson) {
        outputJson = {};
    }

    for (let key in keysOrder) {
        let innerKey = keysOrder[key];
        let currentKey = templateJson[innerKey];
        let keyOrder = getObjKeys(currentKey);

        if (!_.isEmpty(currentKey)) {
            outputJson[innerKey] = createNode(innerKey, currentKey, keyOrder, data, templateName);
        } else {
            outputJson[innerKey] = createNode(innerKey, '', keyOrder, data, templateName);
        }
    }
    return outputJson;
};

/**
 * Function used to create the complete JSON/string for the given input XML node
 * @param {String} node
 * @param {Object} templateJson
 * @param {Array} keysOrder
 * @param {Object} data
 * @param {String} templateName
 * @returns Object for the input XML node based on the template JSON and data
 */
const createNode = (node, templateJson, keysOrder, data, templateName) => {
    let output = null;
    let order = templateJson['ORDER'];
    keysOrder = order || keysOrder;

    if (templateJson) {
        if (typeof templateJson === 'object') {
            output = isArray(templateJson)
                ? bindArrayJson(node, templateJson, data, templateName)
                : bindSingleJson(templateJson, keysOrder, data, null, templateName);
        } else if (typeof templateJson === 'string') {
            output = bindString(templateJson, data);
        }
    }

    return output;
};

/**
 * Function used to form the JSON object for the XML content needs to be generated
 * @param {String} templateName 
 * @param {Object} templateJson 
 * @param {Object} inputJson 
 * @returns Complete JSON for the given XML template 
 */
const createXMLJson = (templateName, templateJson, inputJson) => {
    let templateKeys = getObjKeys(templateJson);
    let xmlRootElement = templateKeys?.length && templateKeys[0] || XML_ROOT || null;
    let outputJson = {};

    // identify root element is valid or not
    if (_.isEmpty(xmlRootElement)) {
        logger.error(`Cannot identify Root element of Json... ${xmlRootElement}`);
        return;
    }
    let xmlRootNode = templateJson[xmlRootElement];

    if (_.isEmpty(xmlRootNode)) {
        logger.error('Root XML node is empty...');
        return;
    }

    let childNodes = getObjKeys(xmlRootNode);

    let HEADER_SEGMENT = {};
    let TRAILER_SEGMENT = {};
    let DATA_SEGMENT = {};

    childNodes.forEach((node) => {
        let keysOrder = getObjKeys(xmlRootNode[node]);
        switch (node) {
            case FILE_HEADER:
                HEADER_SEGMENT = createNode(node, xmlRootNode[FILE_HEADER], keysOrder, inputJson, templateName);
                break;

            case FILE_TRAILER:
                TRAILER_SEGMENT = createNode(node, xmlRootNode[FILE_TRAILER], keysOrder, inputJson, templateName);
                break;

            case CONTENT_NODE:
                DATA_SEGMENT = createNode(node, xmlRootNode[CONTENT_NODE], keysOrder, inputJson, templateName);
                break;
        }
    });

    outputJson[XML_ROOT] = {
        [FILE_HEADER]: HEADER_SEGMENT,
        [CONTENT_NODE]: DATA_SEGMENT,
        [FILE_TRAILER]: TRAILER_SEGMENT
    };

    return outputJson;
};

/**
 * Encoder logic to generate the XML content from the formatted input JSON object
 * @param {String} templateName 
 * @param {Object} i_json 
 * @param {Object} data 
 * @returns Object {
 *  outXml - XML content as string,
 *  errors - XML errors
 * }
 */
const encoder = async (templateName, i_json, data) => {
    let outputJson = await createXMLJson(templateName, i_json, data);
    let output = builder.create(outputJson,
        {
            encoding: 'UTF-8',
            keepNullNodes: true,
            keepNullAttributes: true
        })
        .att({
            'xmlns': NAMESPACE,
            'xmlns:xsi': XMLSCHEMA_INSTANCE,
            'xmlns:schemaLocation': XMLSCHEMA_INSTANCE_LOCATION
        })
        .end({ pretty: true });

    return {
        outXml: output,
        errors: []          // The XML content validation errors will be handled later
    };
};

/**
 * Function used to fetch the previous submitted claim
 * @param {Object} data 
 * @returns Object of the FT1 segment of previously submitted claim
 */
const processOldData = async (data) => {
    let {
        claim_id,
        root_directory,
        file_path,
        uploaded_file_name
    } = data || {};

    let response = {
        error: null,
        old_data: null
    };

    if (!claim_id) {
        let errMsg = `No Claim # passed to fetch old claim details`;
        response.error = errMsg;
        return response;
    }

    try {
        let dirPath = path.join(root_directory);
        let dirStat = await fsPromises.stat(dirPath);

        if (!dirStat.isDirectory()) {
            logger.error(`Error while reading old claim data in C570 template for claim # ${claim_id}...`);
            return {
                status: 100,
                error: 'Directory not found in file store'
            };
        }

        let filePath = path.join(file_path);
        let fileStat = await fsPromises.stat(filePath);

        if (!fileStat?.isFile()) {
            return {
                status: 100,
                error: 'File not found in directory'
            };
        }

        let fileContent = await fsPromises.readFile(filePath, 'utf8');

        await xmlParser(fileContent, { explicitArray: false }, (err, result) => {

            if (err) {
                logger.error(err);
                response.error = err;
                return response;
            };

            if (!result || _.isEmpty(result[XML_ROOT])) {
                let msg = `No data/root element found in the XML file..`;
                response.error = msg;
                logger.error(msg);
                return response;
            }

            let {
                [XML_ROOT]: {
                    [CONTENT_NODE]: {
                        [CONTENT_GRP_4]: {
                            [CONTENT_LST_5]: {
                                [CONTENT_GRP_3]: {
                                    [CONTENT_GRP_2]: {
                                        [CONTENT_LST_3]: {
                                            [CONTENT_GRP_1]: {
                                                [CONTENT_LST_1]: {
                                                    FT1 = []
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } = result || {};
            let data = {};

            if (_.isEmpty(FT1)) {
                response.error = `No data found for previously submitted claim!`;
                return response;
            }

            data = isArray(FT1) && FT1.length > 1
                ? FT1[1]    // get new claim data of previously submitted C570 template
                : FT1       // get new claim data of previously submitted C568 template

            data[INVOICE_TYPE_CODE] = 'CG';
            data[TRANSACTION_CODE] = '';
            data[TRANSACTION_DESCRIPTION] = '';
            data[ICD_LST_SEGMENT][ICD_POB_SEGMENT] = _.filter(data[ICD_LST_SEGMENT][ICD_POB_SEGMENT], (diagData) => diagData[ICD_CODE_SEGMENT] === 'DIAGCD');

            response.old_data = data;
            return response;
        });

        return response;
    } catch (err) {

        let errMsg = `Error occured while processing previously submitted file - ${err}`;
        logger.error(errMsg);
        response.error = errMsg;

        return response;
    }
};

module.exports = {
    getObjKeys,
    bindArrayJson,
    bindString,
    bindSingleJson,
    createNode,
    createXMLJson,
    encoder,
    processOldData
};