'use strict';

const crypto = require('crypto');
const fs = require('fs');
const {
    promisify,
} = require('util');

const mkdirp = require('mkdirp');
const mkdirpAsync = promisify(mkdirp);
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const moment = require('moment');
const _ = require('lodash');
const siteConfig = require('../../server/config');
const logger = require('../../logger');
const JSZip = require('jszip');
const sftpClient = require('ssh2-sftp-client');
const ahsData = require('../../server/data/ahs');
const ahsController = require('../../server/controllers/ahs');
const privateKeyPath = siteConfig.get('ahsSFTPPrivateKeyPath');
const config = {
    host: siteConfig.get('ahsSFTPAddress'),
    user: siteConfig.get('ahsSFTPUser'),
    password: siteConfig.get('ahsSFTPPassword'),
    port: siteConfig.get('ahsSFTPPort'),
    algorithms: {
        cipher: ['aes128-cbc']
    },
    privateKey: fs.existsSync(privateKeyPath) && fs.readFileSync(privateKeyPath, 'utf8'),
    passphrase: siteConfig.get('ahsSFTPPrivateKeyPassPhrase') || undefined // wont be needed in production
};
const uploadDirPath = siteConfig.get('ahsSFTPSendFolder') || `UPLOAD`;
const downloadDirPath = siteConfig.get('ahsSFTPDownloadFolder') || `DOWNLOAD`;

/**
 * @param   {string[]}  files
 * @param   {string}    dirPath
 * @return {Promise<{filename: string, content: string}[]>}
 */
function* processFiles ( files, dirPath ) {
    const jszip = new JSZip();
    const regBackup = /INPUT\.BACKUP\./;

    /**
     * @param file
     * @return {Promise<{filename: string, content: string}[]|Array>}
     */
    async function processFile ( file ) {
        // Only bother with the "DAILY.OUTBB" files (and whatever ARD is called)
        if ( regBackup.test(file) ) {
            return [];
        }

        try {
            const fileData = await readFileAsync(`${dirPath}/${file}`, { 'encoding': `binary` });
            const contents = await jszip.loadAsync(fileData);
            const filenames = Object.keys(contents.files);
            const results = filenames.map(async zipFilePath => {
                const bufferContent = await jszip.file(zipFilePath).async(`nodebuffer`);
                const content = bufferContent.toString(`utf8`);
                const file_name = zipFilePath.split(/\//g).pop();

                let file_md5 = crypto
                    .createHash(`MD5`)
                    .update(bufferContent, `utf8`)
                    .digest(`hex`);

                await writeFileAsync(`${dirPath}/${file_name}`, bufferContent);
                const stat = await statAsync(`${dirPath}/${file_name}`);
                let file_type = file.indexOf('OUTBB') > -1 ? 'can_ahs_bbr' :
                    file.indexOf('ASSMT') > -1 ?  'can_ahs_ard' : '';

                return {
                    file_md5,
                    file_name,
                    file_size: stat.size,
                    content,
                    file_type,
                };
            });

            return await Promise.all(results);
        }
        catch ( e ) {
            logger.error(`Unable to read file at ${file} - `, e);
            return [];
        };
    }

    for ( let i = 0; i < files.length; ++i ) {
        yield processFile(files[ i ]);
    }
}

const sftpService = {

    /**
   * Upload the files into SFTP server
   * {@param} data - which contains fileName, folderPath of uploading file
   * {@param} cb - callback fn
   */
    upload: async (data) => {

        let sftp = new sftpClient;

        try {
            let {
                folderPath,
                fileName
            } = data;

            await sftp.connect(config);

            let isFolderExists = await sftp.exists(uploadDirPath);

            if (!isFolderExists) {
                sftpService.sendDataError('AHS Remote folder not found for upload');
            }

            await sftp.fastPut(`${folderPath}/${fileName}`, `${uploadDirPath}/${fileName}`);

            return {
                err: null,
                response: {
                    status: 'ok',
                    message: 'Files uploaded succesfully'
                }
            };
        }
        catch (e) {
            logger.error('Error occured while AHS SFTP file upload', e.message);
            return {
                err: e.message,
                response: {}
            };
        }
        finally {
            sftp.end();
            logger.error('AHS SFTP files upload process done');
        }
    },

    /**
   * Download the files from SFTP server
   * {@param} data - which contains fileName, companyId of uploading file
   * {@param} cb - callback fn
   */
    download: async (data) => {
        let {
            companyId
        } = data;

        let sftp = new sftpClient;

        try {
            let fileStoreDetails = await ahsData.getCompanyFileStore(companyId);
            let {
                file_store_id: fileStoreId,
                root_directory,
                submitter_prefix
            } = fileStoreDetails.rows.pop();

            if ( !root_directory ) {
                sftpService.sendDataError(`Company file store missing for companyId ${companyId}`);
            }

            try {
                await statAsync(root_directory);
            }
            catch ( e ) {
                sftpService.sendDataError('Company file store folder missing in server file system');
            }

            await sftp.connect(config);
            let remotePathExists = await sftp.exists(downloadDirPath);

            if ( !remotePathExists ) {
                sftpService.sendDataError(`AHS Remote folder not found for download at ${downloadDirPath}`);
            }

            let fileList = await sftp.list(downloadDirPath);

            if ( !fileList.length ) {
                return {
                    err: null,
                    response: {
                        status: `ok`,
                        message: `There are no files to download`
                    }
                };
            }

            const now = moment();
            const created_dt = now.format();
            const fileDir = `AHS/${now.format('YYYY/MM/DD')}`;
            let filePath = `${root_directory}/${fileDir}`;

            await mkdirpAsync(filePath);

            const promises = _.map(fileList, async (file) => {
                const downloadPath = `${downloadDirPath}/${file.name}`;
                const savePath = `${filePath}/${file.name}`;
                await sftp.fastGet(downloadPath, savePath);
                await sftp.delete(downloadPath);
                return file.name;
            });

            const savedPaths = await Promise.all(promises);

            // Call separate functions to extract data, shred into DB and add row to edi_files and match with
            // edi_related_files
            //
            const extract = processFiles(savedPaths, filePath);
            let extractedFiles = extract.next();

            while ( !extractedFiles.done ) {
                // handle each set of files

                const fileInfoArray = await extractedFiles.value;

                for ( let i = 0; i < fileInfoArray.length; ++i ) {
                    const fileInfo = fileInfoArray[ i ];

                    const {
                        file_name,
                        file_md5,
                        file_size,
                        content,
                        file_type
                    } = fileInfo;

                    await ahsData.storeFile({
                        file_name,
                        file_md5,
                        file_size,
                        file_store_id: fileStoreId,
                        companyId,
                        company_id: companyId,
                        file_path: fileDir,
                        created_dt,
                        file_type,
                    });

                    // @TODO - is only raw text still, pending EXA-18282
                    // @TODO - will also need to update edi_related_files.response_file_id
                    /*await ahsData.batchBalanceClaims({
                        company_id: companyId,
                        balance_claims_report: content,
                    });*/
                }

                extractedFiles = extract.next();
            }

            return {
                err: null,
                response: {
                    status: `ok`,
                    message: `${savedPaths.length} files downloaded successfully`
                }
            };
        }
        catch (e) {
            logger.error('Error occured in files download', e.message);
            return {
                err: e.message,
                response: {}
            };
        }
        finally {
            sftp.end();
            logger.error('AHS SFTP files download process done');
        }

    },

    /**
   * Function used to identify the SFTP action based req.param
   */
    events: async (data) => {
        let {
            action
        } = data;

        switch(action){
            case 'updload':
                return sftpService.upload(data);
            case 'download':
                return  sftpService.download(data);
            case 'process':
                return ahsController.processFile(data);
        }
    },

    /**
   * Used to throw custom error
   * {@param} Error Message
   */
    sendDataError: (messge) => {
        logger.error(messge);
        throw new Error(messge);
    }
};

module.exports = sftpService;
