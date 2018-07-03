'use strict';

module.exports = (fieldID, fieldValue) => {
    const useToFormat = ['billed_status'].includes(fieldID);

    if (useToFormat) {
        return fieldValue == 'billed' ? ' EXISTS (SELECT  1 FROM billing.charges_studies where studies.id = charges_studies.study_id) ' : '  NOT EXISTS (SELECT  1 FROM billing.charges_studies where studies.id = charges_studies.study_id)';
    }

    return ` ${fieldID} = '${fieldValue}'`;
};
