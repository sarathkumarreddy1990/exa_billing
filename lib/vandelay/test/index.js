
// node index.js -v
const VERBOSE_OUTPUT = process.argv[2] === `-v`;

// the things we're testing
const impl = require('../impl');
const Lendel = require('../lendel');

const {
    validateRecordDescriptor,
    hydrateRecordDescriptor,
} = require('../util');

// the tools we need for testing
const testRecordDescriptor = require('./testRecord-passer');
const extendedTestRecordDescriptor = require('./testRecord-extended');
const testJackedUpRecordDescriptor = require('./testJackedUpRecord');

const testConfig = require('./testConfig');

const extendedTestConfig = {
    ...testConfig,
    'Z': {
        encode: impl.encodeAlphanumeric,
        decode: impl.decodeAlphanumeric,
    },
};

/* -----------------------------------------------------------------------------
 Record Descriptor Validation Engine testing
 ------------------------------------------------------------------------------*/

const runConfigTest = ( testName, descriptor, config, expectResults ) => {
    const results = validateRecordDescriptor(descriptor, config);
    if ( results.length ) {
        if ( expectResults ) {
            if ( VERBOSE_OUTPUT ) {
                console.log(`PASSED: ${testName}; expected some results`);
                console.log(`\t${results.join('\n\t')}`);
            }
        }
        else {
            console.log(`FAILED: ${testName}; unexpected results`);
            console.log(`\t${results.join('\n\t')}`);
        }
    }
    else if ( expectResults ) {
        console.log(`FAILED: ${testName}; expected some results`);
    }
    else if ( VERBOSE_OUTPUT ) {
        console.log(`PASSED: ${testName}; expected no results`);
    }
};

const lendel1 = Lendel(testConfig);

runConfigTest('standard format v. testConfig', testRecordDescriptor, testConfig, false);
runConfigTest('extended format record descriptor v. testConfig', extendedTestRecordDescriptor, testConfig, true);

runConfigTest('extended format record descriptor v. testConfig', extendedTestRecordDescriptor, testConfig, true);
runConfigTest('jacked-up record-descriptor v. testConfig', testJackedUpRecordDescriptor, testConfig, true);

runConfigTest('extended format record descriptor v. extendedTestConfig', extendedTestRecordDescriptor, extendedTestConfig, false);
runConfigTest('jacked-up record-descriptor v. extendedTestConfig', testJackedUpRecordDescriptor, extendedTestConfig, true);

/* -----------------------------------------------------------------------------
 Lendel CODEC Engine testing
 ------------------------------------------------------------------------------*/

/*
 the commented-out-code below can be used to generate a test string
 */
// const validAlphanumericSeedData = {
// 	alphanumericField: "X",
// 	constrainedAlphanumericField: "HELLO",
// 	constantAlphanumericField: null,
// 	enumeratedAlphanumericField: "AA",
// 	paddedAlphanumericField: "^",
// 	leftJustifiedAlphanumericField: "LJ",
// 	explicitRightJustifiedAlphanumericField: "RJ",
//
// 	paddedLeftJustifiedAlphanumericField: "LJ",
// 	paddedEnumeratedAlphanumericField: "BB",
// 	paddedEnumeratedLeftJustifiedAlphanumericField: "CC",
//
//
// 	numericField: 1,
// 	constrainedNumericField: 55555,
// 	constantNumericField: null,
// 	enumeratedNumericField: 66,
// 	paddedNumericField: 1,
// 	leftJustifiedNumericField: 22,
// 	explicitRightJustifiedNumericField: 22,
//
// 	paddedLeftJustifiedNumericField: 22,
// 	paddedEnumeratedNumericField: 88,
// 	paddedEnumeratedLeftJustifiedNumericField: 99,
//
//
// 	dateField: new Date(),
// 	constantDateField: new Date(),
// 	paddedDateField: new Date(),
// 	leftJustifiedDateField: new Date(),
// 	explicitRightJustifiedDateField: new Date(),
//
// 	paddedLeftJustifiedDateField: new Date(),
// };
// const inputStr = lendel1.encodeRecord(validAlphanumericSeedData, lendelRecord);

const inputStr = 'XHELLOWORLDAA~^LJ  RJLJ~~BBCC~1555551232166~122  2222~~8899~2019100420191004~2019100420191004  2019100420191004~';
hydrateRecordDescriptor(testRecordDescriptor);
const outputStr = lendel1.encodeRecord(lendel1.decodeRecord(inputStr, testRecordDescriptor), testRecordDescriptor);

if ( inputStr === outputStr ) {
    if ( VERBOSE_OUTPUT ) {
        console.log('PASSED: lendel1 (w/ testConfig)');
    }
}
else {
    console.log('FAILED: lendel1 (w/ testConfig)');
    if ( VERBOSE_OUTPUT ) {
        console.log(`\tin:  "${inputStr}"`);
        console.log(`\tout: "${outputStr}"`);
    }
}
