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
        public.get_authorization_study_filter(
            auth.as_authorization,
            ARRAY['${authStatuses[ fieldValue.toLowerCase() ]}']
        )
    `;
}
