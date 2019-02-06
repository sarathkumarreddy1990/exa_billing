
const getResourceIDsXML = (resourceIDs) => {
    let xml = '';
    for (let i=0; i<resourceIDs.length; i++) {
        xml += `<resourceIDs>${resourceIDs[i]}</resourceIDs>`;
    }
    return xml;
};


module.exports = {

    EDT_UPLOAD: (args) => {

        const {
            uploads,
        } = args;

        let innerXML = '';

        for (let i = 0; i < uploads.length; i++) {
            const {
                description,
                resourceType,
            } = uploads[i];

            innerXML = `
                <upload>
                    <content />
                    <description>${description}</description>
                    <resourceType>${resourceType}</resourceType>
                </upload>
            `;
                //  <description>${description}</description>
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
            // content,
            // resourceID,
        } = args;

        let innerXML = '';

        for (let i = 0; i < updates.length; i++) {
            const {
                content,
                resourceID,
            } = updates[i];

            innerXML = `
                <updates>
                    <content />
                    <resourceID>${resourceID}</resourceID>
                </updates>
            `
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

    HCV_BASIC_VALIDATE: (args) => {
        const {
            requests,
            locale,
        } = args;

        let innerXML = '';
        requests.forEach(({healthNumber, versionCode}) => {
            innerXML += `
                <hcvRequest>
                    <healthNumber>${healthNumber}</healthNumber>
                    <versionCode>${versionCode}</versionCode>
                </hcvRequest>`;
                //  <feeServiceCodes>A110</feeServiceCodes>
        });

        return `
            <hcv:validate>
                <requests>
                    ${innerXML}
                </requests>
                <locale>${locale || 'en'}</locale>
            </hcv:validate>`;
    },

    HCV_FULL_VALIDATE: ({requests, locale}) => {

    },
};
