const readline = require('readline');
const EBSConnector = require('./index');
const path = require('path');
const fs = require('fs');
const sprintf = require('sprintf');
const moment = require('moment');
const _ = require('lodash');

const {
    responseCodes,
    services,
} = require('./constants');


let ebs = new EBSConnector({
    hcvSoftwareConformanceKey: '65489ecd-0bef-4558-8871-f2e4b71b8e92',
    edtSoftwareConformanceKey: 'b5dc648e-581a-4886-ac39-c18832d12e06',

    edtServiceEndpoint: 'https://ws.conf.ebs.health.gov.on.ca:1443/EDTService/EDTService',

    auditID:124355467675,
    serviceUserMUID: 614200,    // correct
    // serviceUserMUID: 624201,    // incorrect

    username: "confsu+355@gmail.com",
    password: "Password1!",
    ebsCertPath: '/home/drew/projects/exa-sandbox/cfg/exa-ebs.pem',

    isProduction: true,
});


const validEBSCommands = Object.values(services);
// console.log(validEBSCommands);


const shellCommands = ['setMUID'];

// TODO: allow path option for downloads
const validEBSParams = {

    [services.EDT_UPLOAD]: {
        required: ['file'],
        optional: [],
        // required: ['filename', 'resourceType'],
        // optional: ['description'],
    },

    [services.EDT_SUBMIT]: {
        required: ['resourceIDs'],
        optional: [],
    },

    [services.EDT_LIST]: {
        required: [],
        optional: ['resourceType', 'status', 'pageNo',],
    },

    [services.EDT_DOWNLOAD]: {
        // TODO fix ws.js wrapper
        required: ['resourceIDs'],
        optional: ['filestore'],
    },

    [services.EDT_INFO]: {
        required: ['resourceIDs'],
        optional: [],
    },

    [services.EDT_UPDATE]: {
        required: ['filename', 'resourceID'],
        optional: [],
    },

    [services.EDT_DELETE]: {
        required: ['resourceIDs'],
        optional: [],
    },

    [services.EDT_GET_TYPE_LIST]: {
        // NOTE there are no parameters for this service
        required: [],
        optional: [],
    },
};

const logSuccess = (str) => {
    console.log(`\x1b[36m${str}\x1b[0m`);
};

const logProblem = (str) => {
    console.log(`\x1b[33m${str}\x1b[0m`);
};

const logFailure = (str) => {
    console.log(`\x1b[31m${str}\x1b[0m`);
};

ebsFaultHeaders = [
    "Code",
    "Message",
];

const EBS_FAULT_FORMAT_STRING = '%-15s %-55s';
const EBS_FAULT_HEADER_STRING = sprintf(EBS_FAULT_FORMAT_STRING, ...ebsFaultHeaders);


const printEBSFaults = (faults) => {
    console.log('\x1b[37m\x1b[4m%s\x1b[0m', EBS_FAULT_HEADER_STRING);
    faults.forEach((fault) => {
        const ebsFaultStr = sprintf(
            EBS_FAULT_FORMAT_STRING,
            fault.code,
            fault.message,
        );
        logFailure(ebsFaultStr);
    });
};

const resourceHeaders = [
    "ID",
    "Description",
    "Status",
    "Code",
    "Message",      // up to 108 characters :(
];

const RESOURCE_FORMAT_STRING = '%-9s %-14s %13s %9s ';
const RESOURCE_HEADER_STRING = sprintf(RESOURCE_FORMAT_STRING, ...resourceHeaders);


const handleResourceResults = (responses) => {
    console.log('\x1b[37m\x1b[4m%s\x1b[0m', RESOURCE_HEADER_STRING);
    if (responses.length) {
        responses.forEach((response) => {

            const resourceStr = sprintf(
                RESOURCE_FORMAT_STRING,
                response.resourceID || '',
                response.description || '',
                response.status || '',
                response.msg,
            );
            logSuccess(resourceStr);
        });
    }
    else {
        logSuccess('(no results)');
    }
};

const problemHeaders = [
    'Code',
    'Message',
];
const PROBLEM_FORMAT_STRING = '%-12s %-68s';
const PROBLEM_HEADER_STRING = sprintf(PROBLEM_FORMAT_STRING, ...problemHeaders);
const formatProblem = (problem) => {
    return sprintf(PROBLEM_FORMAT_STRING, problem.code, problem.msg);
};
const printProblem = (problem) => {
    logProblem(formatProblem(problem));
};
const printProblems = (problems) => {
    logProblem(`\x1b[4m${PROBLEM_HEADER_STRING}`);
    problems.forEach(printProblem);
};

const detailHeaders = [
    'ID',           // 13
    'Description',  // 10 (for conventional filename)
    'Status',       // 13
    'Created',      // 19
    'Modified'      // 19
];

const DETAIL_FORMAT_STRING = '%-9s %14s  %13s  %19s %19s';
const DETAIL_HEADER_STRING = sprintf(DETAIL_FORMAT_STRING, ...detailHeaders);

const printDetail = (detail) => {

    // 12345678 HGAU73.441 DOWNLOADABLE YYYY-MM-DD HH:mm:ss / YYYY-MM-DD HH:mm:ss

    return sprintf(
        DETAIL_FORMAT_STRING,
        detail.resourceID || '',
        detail.description || '',
        detail.status || '',
        detail.createTimestamp ? moment(detail.createTimestamp).format('YYYY-MM-DD HH:mm:ss /') : '',
        detail.modifyTimestamp ? moment(detail.modifyTimestamp).format('YYYY-MM-DD HH:mm:ss') : '',
    );
};

const printDetailResponse = (results) => {
    console.log('\x1b[37m\x1b[4m%s\x1b[0m', DETAIL_HEADER_STRING);
    results.forEach((result) => {
        if (result.data) {
            result.data.forEach((d) => {
                logSuccess(printDetail(d));
            });
        }
    });
};

const responseHandlers = {

    [services.EDT_UPLOAD]: handleResourceResults,

    [services.EDT_SUBMIT]: handleResourceResults, //

    [services.EDT_UPDATE]: handleResourceResults, //

    [services.EDT_DELETE]: handleResourceResults,

    [services.EDT_DOWNLOAD]: (results) => {
        results.forEach((downloadResponse, responseIndex) => {
            logSuccess(`${downloadResponse.description}: ${downloadResponse.msg}`);
            fs.writeFileSync(path.join(__dirname, downloadResponse.description), downloadResponse.content);
        });
    },

    [services.EDT_LIST]: printDetailResponse,

    [services.EDT_INFO]: printDetailResponse,

    [services.EDT_GET_TYPE_LIST]: (results) => {
        results.forEach((result) => {
            // TODO looks like shit clean this up
            logSuccess(JSON.stringify(result));
        });
    },
};

// const dispatchResponse = (command, commandResponse) => {
//     if (commandResponse.falts.length) {
//         printEBSFault
//     }
// }

const getServiceParams = (commandStr) => {

    const args = commandStr.slice(1);   // take the command portion off of the command string
    const {
        required,
        optional
    } = validEBSParams[commandStr[0]];

    const spTemplate = {
        unsafe: true,   // for conformance testing ... ignores batch size maxes
    };
    // console.log('args: ', args);
    const serviceParams = args.reduce((result, arg) => {

        const param = arg.split('=');   // TODO ha! paramKey=paramValue=paramValue is technically valid syntax
        const paramKey = param[0];

        // check if the current parameter is in the todo list
        const requiredIndex = required.findIndex((p)=>p == paramKey);
        const isRequired = (requiredIndex !== -1);

        if (isRequired || optional.includes(paramKey)) {

            if (isRequired) {
                // remove from the todo list and add to the optional list
                optional.splice(0, 0, required.splice(requiredIndex, 1)[0]);
            }

            if (paramKey === 'resourceIDs') {
                // add the elements of the CSV parameter to the results
                result[paramKey] = (result[paramKey] || []).concat(param[1].split(','));
            }
            else if (paramKey === 'file') {
                const fileParts = param[1].split(':');
                // TODO ensure that fileParts has at least two elements
                const upload = {
                    filename: fileParts[0],
                    resourceType: fileParts[1],
                    description: fileParts[2] || path.basename(fileParts[0]),
                }

                // console.log('description: ', fileParts[2]);
                // console.log('basename: ', path.basename(fileParts[0]));
                // console.log('upload params: ', upload);
                result['uploads'] = (result['uploads'] || []).concat(upload);
                // console.log('result.uploads: ', result.uploads);
                // filename:resourceType:description
            }
            else {
                result[paramKey] = param[1];
            }
        }
        else {
            console.log(`WARNING: '${param[0]}' is not a valid parameter for the '${commandStr[0]}' service`);
        }
        return result;
    }, spTemplate);
    console.log('serviceParams: ', serviceParams);

    if (required.length && !spTemplate.unsafe) {
        // if the todo list still has items on it
        logFailure(`The following parameters are required for this command (${commandStr[0]}):`);
        required.forEach((param) => {
            logFailure(`\t${param}`);
        });
        throw new Error('Cowardly refusing to guess values for mandatory parameters');
    }

    // TODO some parameters are mandatory; split validParams into mandatory and optional
    // then check if all mandatory params are present in 'serviceParams'

    return serviceParams;
};


const showHelp = () => {
    console.log(`Valid commands: ${validEBSCommands.join(', ')}`);
};





const rli = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});




const recursiveAsyncReadLine = () => {
    rli.question('Command ("help" for ... help, or "exit" to ... exit): ', function (answer) {

        // console.log(ebs[answer]);
        const commandStr = answer.trim().split(' ');
        const command = commandStr[0];
        // console.log(`command: ${command}`);
        if (validEBSCommands.includes(command)) {


            let serviceParams = null;
            try {
                serviceParams = getServiceParams(commandStr);
            }
            catch (e) {
                logFailure(e.message);
                return recursiveAsyncReadLine(); //Calling this function again to ask new question
            }
            // console.log("result: ", JSON.stringify(serviceParams));
            // return rli.close(); //closing RL and returning from function.


            // if (services.EDT_UPLOAD === command) {
            //     serviceParams = {uploads:serviceParams.uploads};
            // }
            // else
            // console.log('service params')
            // console.log('serviceParams: ', serviceParams);
            if (services.EDT_UPDATE === command) {
                serviceParams = {updates:[serviceParams]};
            }

            // console.log('service params: ', serviceParams);

            (ebs[command])(serviceParams, (err, commandResponse) => {

                console.log('commandResponse: ', err, commandResponse);
                if (err) {
                    logFailure(err);
                }
                else {

                    if (commandResponse.faults.length) {
                        printEBSFaults(commandResponse.faults);
                    }
                    if (commandResponse.results.length) {

                        // console.log(JSON.stringify(commandResponse.results));
                        const allResponses = commandResponse.results.reduce((responses, result) => {
                            console.log('shell result: ', result);
                            return responses.concat(result);

                        }, []);
                        console.log('allResponses:', allResponses);
                        const groupedResponses = _.groupBy(allResponses, (response) => {
                           console.log('response $: ', response);
                           return !response.code || response.code === responseCodes.SUCCESS;
                        });

                        //
                        //
                        console.log('\n\nGrouped Results: ', JSON.stringify(groupedResponses));

                        if (groupedResponses['false'] && groupedResponses['false'].length) {
                            printProblems(groupedResponses['false']);
                        }
                        if (groupedResponses['true'] && groupedResponses['true'].length) {
                            responseHandlers[command](groupedResponses['true']);
                        }

                        // console.log('RESULTS:', JSON.stringify(commandResponse.results));
                    }
                }

                recursiveAsyncReadLine(); //Calling this function again to ask new question
            });
        }
        else if (command === 'setMUID') {
            ebs = new EBSConnector({
                softwareConformanceKey: 'b5dc648e-581a-4886-ac39-c18832d12e06',
                auditID:124355467675,
                serviceUserMUID: commandStr[1],    // correct
                // serviceUserMUID: 624201,    // incorrect

                username: "confsu+355@gmail.com",
                password: "Password1!",
                ebsPemFile: '/home/drew/projects/exa-sandbox/cfg/exa-ebs.pem',
            });
            recursiveAsyncReadLine();
        }
        else if (command === 'help') {
            showHelp();
            recursiveAsyncReadLine(); //Calling this function again to ask new question
        }
        else if (command === 'exit') {
            return rli.close(); //closing RL and returning from function.
        }
        else {
            logFailure('Not a valid command; please choose from the following: ');
            logFailure(`    ${validEBSCommands.join('\n    ')}`);
            recursiveAsyncReadLine();
        }
    });
};

// get the party started
recursiveAsyncReadLine();
