const DEFAULT_PADDING_CHARACTER = ' ';

const toFormatString = (fieldDescriptor) => {

    const {
        length,
        paddingChar,
        isLeftJustified,
    } = fieldDescriptor;

    const lenMod = length ? `${length}.${length}` : '';
    const padMod = `'${paddingChar}`
    const algnMod = isLeftJustified ? '-' : '';

    return `%${padMod}${algnMod}${lenMod}s`;
};

const toRegexArray = (constraints) => {
    if (constraints) {
        return constraints.map((constraint) => {
            return new RegExp(constraint);
        });
    }
    else {
        return [];
    }
};

const getNumberDependency = (num) => {
    if (typeof(num) !== 'number') {
        return null;
    }

    if (num < 0) {
        return null;
    }
    return num;
};



module.exports = {

    getRecordLength: (recordDescriptor) => {
        return Object.keys(recordDescriptor).reduce((result, fieldName) => {
            return result + recordDescriptor[fieldName].length;
        }, 0);
    },

    /**
     * hydrateRecordDescriptor - description
     *
     * @param  {object} recordDescriptor description
     * @return {object}                  description
     */
    hydrateRecordDescriptor: (recordDescriptor) => {
        Object.keys(recordDescriptor).forEach((fieldName) => {

            const fieldDescriptor = recordDescriptor[fieldName];

            const {
                startPos,
                length,
                constraints,
            } = fieldDescriptor;


            if (!fieldDescriptor.paddingChar) {
                fieldDescriptor.paddingChar = DEFAULT_PADDING_CHARACTER;
            }

            if (constraints) {
                fieldDescriptor.constraints = toRegexArray(constraints);
            }

            // NOTE do this *after* setting paddingChar
            fieldDescriptor.formatString = toFormatString(fieldDescriptor);
        });
    },

    validateRecordDescriptor: (recordDescriptor, config) => {

        let recordDescriptorIsValidForConfig = true;

        const validFormats = Object.keys(config);
        const context = {};

        return Object.keys(recordDescriptor).reduce((validationResults, fieldName) => {

            const fieldDescriptor = recordDescriptor[fieldName];

            const {
                format,
                startPos,
                length,
                padding,
                enumerated,
                isLeftJustified,
                constraints,
            } = fieldDescriptor;

            if (format) {
                if (!validFormats.includes(format)) {
                    validationResults.push(`Field '${fieldName}' has invalid format (${format}) for configuration (${validFormats.join(', ')}).`);
                }
            }
            else {
                validationResults.push(`Field '${fieldName}' is missing mandatory proprty 'format'.`);
            }

            if (startPos) {
                if (typeof(startPos) !== 'number') {
                    validationResults.push(`Field '${fieldName}' has invalid 'startPos' property; expected a number but found a ${typeof(startPos)}.`);
                }
                else {
                    if ( startPos < 0 ) {
                        validationResults.push(`Field '${fieldName}' has invalid 'startPos' property; must be greater than zero.`);
                    }
                    else if ( context.lastEndPos && startPos <= context.lastEndPos ) {
                        validationResults.push(`Field '${fieldName}' has invalid 'startPos' property; must be greater than ${context.lastEndPos}.`);
                    }
                }
            }
            else {
                validationResults.push(`Field '${fieldName}' is missing mandatory proprty 'startPos.'`);
            }

            if (length) {
                if (typeof(length) !== 'number') {
                    validationResults.push(`Field '${fieldName}' has invalid 'length' property; expected a number but found a ${typeof(length)}.`);
                }
                if (length < 0) {
                    validationResults.push(`Field '${fieldName}' has invalid 'length' property; must be greater than zero.`);
                }
                else {
                    // context sensitive validation ;)
                    const start = getNumberDependency(startPos);
                    context.lastEndPos = start ? (start + length - 1) : context.lastEndPos;
                }
            }
            else {
                validationResults.push(`Field '${fieldName}' is missing mandatory proprty 'length.'`);
            }

            if (padding) {
                if (typeof(padding) === 'string') {
                    if (padding.length > 1) {
                        validationResults.push(`Field '${fieldName}' has invalid 'padding' property; expected only one character.`);
                    }
                }
                else {
                    validationResults.push(`Field '${fieldName}' has invalid 'padding' property; expected a string but found a ${typeof(padding)}.`);
                }
            }

            if (enumerated) {
                if (enumerated instanceof Array) {
                    if (enumerated.length) {
                        let enumeratedHasHomogenousTypes = true;
                        const firstType = typeof(enumerated[0]);
                        for (let i = 1; i < enumerated.length && enumeratedHasHomogenousTypes; i++) {
                            enumeratedHasHomogenousTypes &= typeof(enumerated[i]) === firstType;
                        }

                        if (!enumeratedHasHomogenousTypes) {
                            validationResults.push(`Field '${fieldName}' has invalid 'enumerated' property; values must be same type.`);
                        }
                        if (!enumerated[0] instanceof Date && firstType !== 'string' && firstType !== 'number') {
                            validationResults.push(`Field '${fieldName}' has invalid 'enumerated' property; values must dates, strings, or numbers.`);
                        }
                    }
                    else {
                        validationResults.push(`Field '${fieldName}' has invalid 'enumerated' property; must have at least one value.`);
                    }
                }
                else {
                    validationResults.push(`Field '${fieldName}' has invalid 'enumerated' property; Expected an array, but found ${enumerated.constructor}`);
                }
            }

            if (isLeftJustified) {
                if (typeof(isLeftJustified) !== 'boolean') {
                    validationResults.push(`Field '${fieldName}' has invalid 'isLeftJustified' property; expected a boolean but found ${typeof(isLeftJustified)}.`);
                }
            }

            if (constraints) {
                if (constraints instanceof Array) {
                    if (constraints.length) {
                        let constraintsIsValid = true;
                        for (let i = 0; i<constraints.length && constraintsIsValid; i++) {
                            constraintsIsValid &= (typeof(constraints[i]) === 'string');
                            try {
                                new RegExp(constraints[i]);
                            }
                            catch (e) {
                                validationResults.push(`Field '${fieldName}' has invalid 'constraints' property; ${constraints[i]} is not a valid regular expression.`);
                            }
                        }
                        if (!constraintsIsValid) {
                            validationResults.push(`Field '${fieldName}' has invalid 'constraints' property; all values must be strings.`);
                        }
                    }
                    else {
                        validationResults.push(`Field '${fieldName}' has invalid 'constraints' property; expected an array but found ${constraints.constructor}.`);
                    }
                }
            }

            return validationResults;
        }, []);
    },
};
