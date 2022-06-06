'use strict';
const _ = require('lodash');
const builder = require('xmlbuilder');
const { XML_ELEMENTS } = require('./constants');
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
    FEE_MODIFIER_SEGMENT,
    NAMESPACE,
    XMLSCHEMA_INSTANCE,
    XMLSCHEMA_INSTANCE_LOCATION,
    WCB_CORRECTION_CLAIM_TEMPLATE
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

    switch (node) {
        case ICD_POB_SEGMENT:
            let icdArr = data?.diagnosis_codes || [];
            let pobArr = data?.orientation || [];

            for (let i = 0; i < icdArr.length; i++) {
                let keysOrder = getObjKeys(singleTemplateJson);
                outputJson.push(createNode(node, singleTemplateJson, keysOrder, icdArr[i], templateName) || null);
            }

            if (!isCorrectionTemplate) {
                for (let k = 1; k <= 3; k++) { // loop over part of body, side of body and nature of injury combinations
                    for (let j = 0; j < pobArr.length; j++) { // loop over each part of body from database
                        let keysOrder = getObjKeys(templateJson[k]);
                        outputJson.push(createNode(node, templateJson[k], keysOrder, pobArr[j], templateName) || null);
                    }
                }
            }

            break;
        case FEE_MODIFIER_SEGMENT:
            arrData = data?.fee_modifiers || [];

            for (let i = 0; i < arrData.length; i++) {
                let keysOrder = getObjKeys(singleTemplateJson);
                outputJson.push(createNode(node, singleTemplateJson, keysOrder, { 'fee_modifiers': arrData[i] }, templateName) || null);
            }

            break;
        case INVOICE_LINE_SEGMENT:
            arrData = templateJson || [];

            for (let i = 0; i < arrData.length; i++) {
                let keysOrder = getObjKeys(arrData[i]);

                outputJson.push(
                    isCorrectionTemplate && i % 2 === 0
                        ? data.old_claim_data  // read old claim details from previously submitted file data
                        : createNode(node, arrData[i], keysOrder, data, templateName) || null
                );
            }

            break;
        case ATTACHMENT_SEGMENT:
            let attachments = data?.attachments || [];
            let mandatoryFieldsCount = isCorrectionTemplate ? 2 : 3;
            let templateLength = templateJson.length;

            for (let i = 0; i < mandatoryFieldsCount; i++) {
                let keysOrder = getObjKeys(templateJson[i]);
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
                        let keysOrder = getObjKeys(templateJson[k]);
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

module.exports = {
    getObjKeys,
    bindArrayJson,
    bindString,
    bindSingleJson,
    createNode,
    createXMLJson,
    encoder
};