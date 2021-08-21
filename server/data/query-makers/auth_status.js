'use strict';

const authStatuses = {
    "authorized": `authorized`,
    "needauthorization": `needAuthorization`,
    "reauthorization": `reAuthorization`,
    "noauthorization": `noAuthorization`,
};

module.exports = ( fieldID, fieldValue ) => {
    return `
        public.get_authorization_study_filter(
            auth.as_authorization,
            ARRAY['${authStatuses[ fieldValue.toLowerCase() ]}']
        )
    `;
}
