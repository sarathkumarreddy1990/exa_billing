importScripts('/exa_modules/billing/static/node_modules/pdfmake/build/pdfmake.min.js');
importScripts('/exa_modules/billing/static/node_modules/pdfmake/build/vfs_fonts.js');


onmessage = function (req) {
    console.log('Request received from client');

    new Promise(function (resolve, reject) {
        generatePdfBlob(req.data, function (result) {
            if (result) {
                resolve(result);
            } else {
                reject();
            }
        });
    }).then(function (pdfBlob) {
        postMessage({ pdfBlob });
    });
};


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
