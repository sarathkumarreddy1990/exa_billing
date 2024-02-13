'use strict';

const authStatuses = {
    "authorized": `authorized`,
    "needauthorization": `needauthorization`,
    "reauthorization": `reauthorization`,
    "noauthorization": `noauthorization`,
    "pending": `pending`,
    "partial": `partial`,
    "denied": `denied`,
    "none": `none`
};

module.exports = ( fieldID, fieldValue ) => {
    return `
        public.get_authorization_status_by_study(studies.id) = ANY(ARRAY['${authStatuses[ fieldValue.toLowerCase() ]}'])
    `;
}
