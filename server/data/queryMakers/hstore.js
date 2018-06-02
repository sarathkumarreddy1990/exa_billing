'use strict';

module.exports = (fieldID, fieldValue) => {
    const useToFormat = ["contact_info-> 'FAXNO'", "contact_info-> 'OFFAXNO'", "contact_info->'OFPHNO'", "contact_info-> 'PHNO'"].includes(fieldID);

    if (useToFormat) {
        fieldValue = fieldValue.replace(/[^0-9]/g, '');
        return `  regexp_replace(COALESCE(${fieldID}, ''), '[^0-9]', '', 'g') ILIKE '%${fieldValue}%'`;
    }

    return ` ${fieldID} ILIKE '${(["payment_info->'payer_name'"].indexOf(fieldID) === -1 || fieldValue.length > 3 ? '%' : '') + fieldValue}%'`;
};

