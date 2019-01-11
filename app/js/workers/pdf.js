importScripts('/exa_modules/billing/static/node_modules/pdfmake/build/pdfmake.min.js');
importScripts('/exa_modules/billing/static/node_modules/pdfmake/build/vfs_fonts.js');


onmessage = function (req) {
    console.log('Request received from client');

    new Promise(function (resolve, reject) {
        generatePdfBlob(req.data, function (result) {
            if (result) {
                dataURLtoBlob(result, function (response) {
                    resolve(response);
                });
            } else {
                reject();
            }
        });
    }).then(function (pdfBlob) {
        postMessage({ pdfBlob });
    });
};

function dataURLtoBlob(pdfDataUrL, callback) {
    var base64Str = pdfDataUrL.split(',');
    var mimeType = base64Str[0].match(/:(.*?);/)[1];

    var decodedBase64Str = atob(base64Str[1]);
    var decodedBase64StrLength = decodedBase64Str.length;
    var u8Arr = new Uint8Array(decodedBase64StrLength);

    while (decodedBase64StrLength--) {
        u8Arr[decodedBase64StrLength] = decodedBase64Str.charCodeAt(decodedBase64StrLength);
    }

    return callback(URL.createObjectURL(new Blob([u8Arr], { type: mimeType })));
}

function generatePdfBlob(docDefinition, callback) {
    if (!callback) {
        throw new Error('generatePdfBlob is an async method and needs a callback');
    }

    //const docDefinition = generateDocDefinition(myData);
    // pdfMake.createPdf(docDefinition).getBlob(callback);
    pdfMake.createPdf(docDefinition).getDataUrl(callback);
}


function generateDocDefinition(myData) {
    return { content: ['First paragraph', 'Another paragraph'] };
}
