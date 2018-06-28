// This is awkward but needed to make pdfmake work on web workers
// https://github.com/bpampuch/pdfmake/issues/38#issuecomment-149095815
window = this;
document = { createElementNS: function () { return {}; } };


// Substitute with the path to your pdfmake and vfs_fonts script
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
