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
            const jszip = new JSZip();
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
        }
    }

    for ( let i = 0; i < files.length; ++i ) {
        yield processFile(files[ i ]);
    }
}

/**
 * @param   {number}            duration - in ms
 * @param   {function?}         cb - optional, run after timer finishes
 * @return  {Promise<unknown>}
 */
function delay ( duration, cb ) {
    if ( !(duration > 0) ) {
        throw new Error(`Sleep duration (ms) required`);
    }

    return new Promise(( resolve, reject ) => {
        setTimeout(() => {
            try {
                const result = cb?.();
                resolve(result);
            }
            catch (e) {
                reject(e.message);
            }
        }, duration);
    });
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
                sftpService.sendDataError(`[UPLOAD] AHS Remote folder not found for upload`);
            }

            await sftp.fastPut(`${folderPath}/${fileName}`, `${uploadDirPath}/${fileName}`);

            return {
                err: null,
                response: {
                    status: `ok`,
                    message: `[UPLOAD] Files uploaded succesfully`,
                }
            };
        }
        catch (e) {
            logger.error(`[UPLOAD] Error occured while AHS SFTP file upload`, e.message);
            return {
                err: e.message,
                response: {}
            };
        }
        finally {
            sftp.end();
            logger.info(`[UPLOAD] AHS SFTP files upload process done`);
        }
    },

    /**
   * Download the files from SFTP server
   * {@param} data - which contains fileName, companyId of uploading file
   * {@param} cb - callback fn
   */
    download: async function download (data) {
        let {
            company_id
        } = data;

        let sftp = new sftpClient;

        try {
            let fileStoreDetails = await ahsData.getCompanyFileStore(company_id);
            let {
                file_store_id,
                root_directory,
            } = fileStoreDetails.rows.pop();

            if ( !root_directory ) {
                sftpService.sendDataError(`[DOWNLOAD] Company file store missing for companyId ${company_id}`);
            }

            try {
                await statAsync(root_directory);
            }
            catch ( e ) {
                sftpService.sendDataError(`[DOWNLOAD] Company file store folder missing in server file system`);
            }

            try {
                await sftp.connect(config);
            }
            catch (e) {
                logger.error(`[DOWNLOAD] ${e.message}`);
                // Give it a few seconds and try again ... until it works
                // Don't want accidental DoS
                await delay(5000);
                return await sftpService.download(data);
            }

            let remotePathExists = await sftp.exists(downloadDirPath);

            if ( !remotePathExists ) {
                sftpService.sendDataError(`[DOWNLOAD] AHS Remote folder not found for download at ${downloadDirPath}`);
            }

            let fileList = await sftp.list(downloadDirPath);

            if ( !fileList.length ) {
                return {
                    err: null,
                    response: {
                        status: `ok`,
                        message: `[DOWNLOAD] There are no files to download`
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
                        file_type
                    } = fileInfo;

                    logger.info(`[DOWNLOAD] Writing the file ${file_type} - ${file_name} into Database...`);

                    await ahsData.storeFile({
                        file_name,
                        file_md5,
                        file_size,
                        file_store_id,
                        companyId: company_id,
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

            logger.info(`[DOWNLOAD] AHS SFTP files download process done`);

            return {
                err: null,
                response: {
                    status: `ok`,
                    message: `[DOWNLOAD] ${savedPaths.length} files downloaded successfully`
                }
            };
        }
        catch (e) {
            logger.error(`[DOWNLOAD] Unrecoverable error during files download attempt`, e.message);
            return {
                err: e.message,
                response: {}
            };
        }
        finally {
            sftp.end?.();
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
            case 'upload':
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
