'use strict';

const fs = require('fs');
const {
    promisify,
} = require('util');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const statAsync = promisify(fs.stat);
const mkdirpAsync = promisify(mkdirp);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const _ = require('lodash');
const moment = require('moment');
const logger = require('../../logger');
const data = require('../../server/data/era/index');
const sftpClient = require('ssh2-sftp-client');
const shared = require('../../server/shared');
const claimData = require('../../server/data/claim/claim-workbench');

const sftpService = {

    /**
     * Upload the files into SFTP server
     * {@param} claimInfo - which contains companyId, sftpData, ediText of uploading file
     */
    upload: async (claimInfo) => {

        let sftp = new sftpClient;

        let {
            companyId,
            sftpData,
            ediText
        } = claimInfo;

        try {            

            const fileSqlResponse = await data.getCompanyFileStore(companyId);

            if (!fileSqlResponse || fileSqlResponse.rows.length === 0) {
                logger.error('Company file store not found', companyId);
                return {
                    err: 'Company file store not found',
                    response: {}
                };
            }

            const {
                file_store_id,
                root_directory
            } = fileSqlResponse.rows.pop();

            const now = moment();
            const created_dt = now.format();
            const today = now.format('YYYY/MM/DD');
            const file_name = `edi_${shared.getUID().replace(/\./g, '')}`;
            const file_path = `EDI/${today}`;
            const folderPath = `${root_directory}/${file_path}`;
            const fullPath = `${folderPath}/${file_name}`;

            await mkdirpAsync(folderPath);
            await writeFileAsync(fullPath, ediText, { 'encoding': `utf8` });

            let {
                size: file_size,
            } = await statAsync(fullPath);

            let file_md5 = crypto
                .createHash(`MD5`)
                .update(ediText, `utf8`)
                .digest(`hex`);
            let file_type = '837';

            const edi_file_id = await claimData.storeFile({
                file_name,
                file_md5,
                file_size,
                file_type,
                file_store_id,
                companyId,
                file_path,
                created_dt,
            });

            const config = {
                host: sftpData.host,
                user: sftpData.user,
                password: sftpData.password,
                port: sftpData.port,

                algorithms: {
                    cipher: ['aes128-cbc']
                }
            };
            await sftp.connect(config);

            let isFolderExists = await sftp.exists(sftpData.uploadDirPath);

            if (!isFolderExists) {
                sftpService.sendDataError('EDI Remote folder not found for upload');
            }

            await sftp.fastPut(`${folderPath}/${file_name}`, `${sftpData.uploadDirPath}/${file_name}`);

            return {
                err: null,
                edi_file_id: edi_file_id,
                response: {
                    status: 'ok',
                    message: 'Files uploaded succesfully'
                }
            };
        }
        catch (e) {
            logger.error('Error occurred while EDI SFTP file upload', e.message);
            return {
                err: e.message,
                response: {}
            };
        }
        finally {
            sftp.end();
            logger.info('EDI SFTP files upload process done');
        }
    },

    /**
     * Download the files from SFTP server
     * {@param} - which contains companyId, sftpInfo of downloading file
     */
    download: async (companyId, sftpInfo) => {
        let {
            name,
            config = {}
        } = sftpInfo || {};

        if (config && !config.enable_ftp) {
            logger.info(`SFTP option not enabled in ${name} clearing house, skipping process.`);
            return {
                error: true,
                message: 'SFTP connection not in enabled mode'
            };
        }

        let sftp = new sftpClient;

        try {
            let fileStoreDetails = await data.getCompanyFileStore(companyId);
            let {
                file_store_id,
                root_directory,
            } = fileStoreDetails.rows.pop();

            if (!root_directory) {
                logger.error(`ERA sftp download | Company file store missing for companyId ${companyId}`);
                sftpService.sendDataError(`Company file store missing for companyId ${companyId}`);
            }

            try {
                await statAsync(root_directory);
            }
            catch (e) {
                logger.error('ERA sftp download | Company file store folder missing in server file system');
                sftpService.sendDataError('Company file store folder missing in server file system');
            }

            await sftp.connect({
                host: config.ftp_host,
                user: config.ftp_user_name,
                password: config.ftp_password,
                port: config.ftp_port
            });

            let downloadDirPath = config.ftp_receive_folder || 'responses';
            let remotePathExists = await sftp.exists(downloadDirPath);

            if (!remotePathExists) {
                logger.error(`ERA | SFTP Remote folder not found for download at '${downloadDirPath}'`);
                sftpService.sendDataError(`SFTP Remote folder not found for download at '${downloadDirPath}'`);
            }

            let fileList = await sftp.list(downloadDirPath);

            if (!fileList.length) {
                return {
                    error: true,
                    message: `There are no files to download`,
                    response: {}
                };
            }

            const now = moment();
            const created_dt = now.format();
            const fileDir = `ERA/${now.format('YYYY/MM/DD')}`;
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

            /**
             * Register downloaded files into DB
             */

            const results = savedPaths.map(async fileName => {
                const fileData = await readFileAsync(`${filePath}/${fileName}`, { 'encoding': `binary` });
                const stat = await statAsync(`${filePath}/${fileName}`);
                const content = fileData.toString(`utf8`);

                let file_md5 = crypto
                    .createHash(`MD5`)
                    .update(content, `utf8`)
                    .digest(`hex`);

                logger.info('ERA sftp download | writing file in DB');

                /**
                 * Default values assigned for status, type
                 */
                return await data.saveERAFile({
                    file_store_id,
                    company_id: companyId,
                    status: 'pending',
                    file_type: '835',
                    file_path: fileDir,
                    file_size: stat.size,
                    file_md5,
                    fileName,
                    isEOB: false
                });

            });

            const response = await Promise.all(results);

            if (response && response instanceof Error) {
                logger.error('ERA sftp download | Error on writing file in DB');
            }

            return {
                error: null,
                response: {
                    status: `ok`,
                    message: `${savedPaths.length} files downloaded successfully`
                }
            };
        }
        catch (e) {
            logger.error('Error occurred in files download', e);
            return {
                error: true,
                message: e.message.replace(/[^\w\s]/gi, ''),
                response: {}
            };
        }
        finally {
            sftp.end();
            logger.info('ERA SFTP files download process done. sftp connection terminated');
        }

    },

    initiateDownload: async (params) => {
        let {
            companyId = null
        } = params;

        let sftpDetails = await data.getClearingHouseList(companyId) || {};

        if (!sftpDetails.length) {
            logger.info('ERA sftp download | Clearing house not configured');
            return {
                error: true,
                message: 'Clearing house not configured'
            };
        }

        let requests = _.map(sftpDetails, (sftp, index) => {
            return new Promise(async (resolve, reject) => {
                const data = await sftpService.download(companyId, sftp);
                resolve(data);
            });
        });

        logger.info('ERA sftp download process started..');

        let processedResult = await Promise.all(requests).catch(function (err) {
            logger.error(`Error on download process.. - ${err}`);
            return err;
        });

        let erroneous_list = _.filter(processedResult, { 'error': true });
        let response;

        if (erroneous_list.length === processedResult.length) {
            response = {
                status: 'error',
                message: erroneous_list[0].message || 'Error on SFTP process see billing log'
            };
        } else if (erroneous_list.length) {
            response = {
                status: 'error',
                message: 'Partially files downloaded, For other see billing log'
            };
        } else {
            response = {
                status: 'ok',
                message: 'ERA sftp download process successfully completed'
            };
        }

        return response;
    },

    /**
     * Function used to identify the SFTP action based req.param
     */
    events: async (data) => {
        let {
            action
        } = data;

        switch (action) {
            case 'download':
                return sftpService.initiateDownload(data);
        }
    },

    /**
     * Used to throw custom error
     * {@param} Error Message
     */
    sendDataError: (message) => {
        logger.error(message);
        throw new Error(message);
    }
};

module.exports = sftpService;
