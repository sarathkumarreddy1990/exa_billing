const {
    locationOfService, 
    prefix, 
    province,
    positiveValues,
    negativeValues,
    daysOfMonth
} = require('./formatters');

const utils = {

    /**
     * @param recordData - Each line data sending to parse
     * @param recordFields - Configuration Info for parsing data
     * @return JSON - Parsed Data
     */
    parseRecord: (recordData, recordFields) => {
        let parsedData = {};

        for (let fieldName in recordFields) {
            parsedData[fieldName] = utils.getValue(recordFields[fieldName], recordData);
        }

        return parsedData;
    },

    /**
     * getValue - Uses the specified field descriptor to retrieve the data from
     * the specified record string.
     *
     * @param  {object} field {
     *                            startPos: <number:required>,
     *                            fieldLength: <number:required>,
     *                            format: <string:optional>
     *                        }
     * @param  {string} recordStr an entire record
     * @return {string}           the field value of the record
     */
    getValue: (field, recordStr) => {
        let fieldStr = recordStr.substr(field.startPos - 1, field.fieldLength);

        switch (field.format) {

            case 'money':
                return parseInt(fieldStr) / 100;

            case 'feeAssessed':
                let char = fieldStr.charAt(5);
                let isNegative = negativeValues.indexOf(char) > -1;
                let values = isNegative && negativeValues || positiveValues;

                fieldStr = `${isNegative ? '-' : ''}` + fieldStr.replace(char, values.indexOf(char).toString());

                return parseInt(fieldStr) / 100;

            case 'YYMMDD':
            case 'julian':
                let month = 1;
                let days;
                let YY = fieldStr.substr(0, 2);
                let CC = parseInt(new Date().getFullYear() / 100); // To identify the century of the year
                let year = `${CC}${YY}`;

                daysOfMonth[1] = (!(year % 4) && '29') || '28';  // To identify leap year

                if (fieldStr.length === 5) {
                    days = parseInt(fieldStr.substr(2, 3));

                    daysOfMonth.forEach(item => {
                        if (days > item) {
                            days -= item;
                            month++;
                        }
                    });
                } else {
                    //for splitting the days in YYMMDD format
                    days = parseInt(fieldStr.substr(4, 2));
                    month = parseInt(fieldStr.substr(2, 2));
                }

                month = month < 10 && `0${month}` || month;
                days = days < 10 && `0${days}` || days;
                return `${year}-${month}-${days}`; // for the years in range 2000 - 2099

            case 'prefix':
                return prefix[fieldStr] || fieldStr;

            case 'los':
                return locationOfService[fieldStr];

            case 'numeric':
                return parseInt(fieldStr);

            case 'eobObj':
                let eobArr = fieldStr.trim().match(/.{2}/g) || [];
                let eobCodes = [];

                eobArr.forEach((value) => {
                    eobCodes.push({'code': value,
                        'amount': 0});
                }); 

                return eobCodes || []; 
            
            case 'eobArr':
                return fieldStr.trim().match(/.{2}/g) || []; // Returning EOB codes as array. eg:["C2", "77", "DR"]

            case 'province':
                return province[fieldStr.trim()];

            case 'serviceCode':
                return recordStr.substr(field.startPos - 2, 1) + fieldStr;

            default:
                return fieldStr.trim();
        }
    }
};

module.exports = utils;
