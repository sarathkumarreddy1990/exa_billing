
const getResourceIDsXML = (resourceIDs) => {
    return resourceIDs.map((resourceID) => {
        return `<resourceIDs>${resourceID}</resourceIDs>`;
    }).join('\n');
};


module.exports = {

    EDT_UPLOAD: (args, ctx) => {

        const {
            uploads,
        } = args;

        let innerXML = '';

        if (uploads) {
            innerXML = uploads.map(({description, resourceType}) => {

                return `
                    <upload>
                        <content />
                        <description>${description}</description>
                        <resourceType>${resourceType}</resourceType>
                    </upload>
                `;
            }).join('\n');
        }

        return `
            <edt:upload>
                ${innerXML}
            </edt:upload>
        `;
    },

    EDT_SUBMIT: (args) => {

        const {
            resourceIDs
        } = args;

        return `
            <edt:submit>
                ${getResourceIDsXML(resourceIDs)}
            </edt:submit>
        `;
    },

    EDT_DOWNLOAD: (args) => {
        const {
            resourceIDs
        } = args;

        return `
            <edt:download>
                ${getResourceIDsXML(resourceIDs)}
            </edt:download>
        `;
    },

    EDT_LIST: (args)=> {

        const {
            resourceType,
            status,
            pageNo,
        } = args;

        let innerXML = '';

        innerXML += resourceType ? `<resourceType>${resourceType}</resourceType>`: '';
        innerXML += status ? `<status>${status}</status>`: '';
        innerXML += pageNo ? `<pageNo>${pageNo}</pageNo>`: '';

        return `
            <edt:list>
                ${innerXML}
            </edt:list>
        `;
    },

    EDT_INFO: (args)=> {
        const {
            resourceIDs,
        } = args;

        return `
            <edt:info>
                ${getResourceIDsXML(resourceIDs)}
            </edt:info>
        `;
    },

    EDT_DELETE: (args)=> {
        const {
            resourceIDs,
        } = args;

        return `
            <edt:delete>
                ${getResourceIDsXML(resourceIDs)}
            </edt:delete>
        `;
    },

    EDT_UPDATE: (args)=> {
        const {
            updates,
        } = args;
        let innerXML = '';

        if (updates) {

            innerXML = updates.map(({resourceID}) => {
                return `
                    <updates>
                        <content />
                        <resourceID>${resourceID}</resourceID>
                    </updates>`;
            }).join('\n');
        }

        return `
            <edt:update>
                ${innerXML}
            </edt:update>
        `;
    },

    EDT_GET_TYPE_LIST: (args) => {
        return `<edt:getTypeList/>`;
    },

    HCV: (args) => {

        const {
            hcvRequests,
        } = args;

        let innerXML = '';
        if (hcvRequests) {
            innerXML = hcvRequests.map(({healthNumber, versionCode, feeServiceCode}) => {

                const feeServiceCodeStr = feeServiceCode ? `<feeServiceCodes>${feeServiceCode}</feeServiceCodes>` : '';

                return `
                    <hcvRequest>
                        <healthNumber>${healthNumber}</healthNumber>
                        <versionCode>${versionCode}</versionCode>
                        ${feeServiceCodeStr}
                    </hcvRequest>`;

            }).join('\n');
        }

        return `
            <hcv:validate>
                <requests>
                    ${innerXML}
                </requests>
                <locale>en</locale>
            </hcv:validate>`;
    },
};
