

module.exports = {


    MONTH_CODE_JANUARY: 65, // 'January' as a processing cycle month code

    encoding: 'ascii',      // encoding scheme to read and write files in

    encoder: {

        endOfRecord: '\x0D',    // value appended to the end of every record in a
                                // claim-submission string

        endOfBatch: '\x1A',     // value appended to the end of every
                                // claim-submission string

    },

    decoder: {
        endOfRecord: '\n',

        
    },

};
