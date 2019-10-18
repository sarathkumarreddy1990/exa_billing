const {
    promisify,
} = require('util');

const mkdirp = require('mkdirp');
const mkdirpAsync = promisify(mkdirp);
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const siteConfig = require('../../server/config');
const logger = require('../../logger');
const sftpClient = require('ssh2-sftp-client');
const ahsData = require('../../server/data/ahs');
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
    passphrase: siteConfig.get('ahsSFTPPublicKeyPassPhrase')
};
const uploadDirPath = siteConfig.get('ahsSFTPSendFolder'); //'/home/radha/Pictures' - //Using for dev env will remove later;
const downloadDirPath = siteConfig.get('ahsSFTPDownloadFolder'); // '/home/radha/Pictures //Using for dev env will remove later';

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

            await sftp.fastPut(`${folderPath}/${fileName + '12'}`, `${uploadDirPath}/${fileName}`);

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
                root_directory,
                submitter_prefix
            } = fileStoreDetails.rows.pop();

            //root_directory = '/home/radha/Documents/data'; // to support linux file system in dev env

            if (!root_directory) {
                sftpService.sendDataError('Company file store missing');
            }

            if (!fs.existsSync(root_directory)) {
                sftpService.sendDataError('Company file store folder missing in server file system');
            }

            await sftp.connect(config);
            let isExist = await sftp.exists(downloadDirPath);

            if (!isExist) {
                sftpService.sendDataError('AHS Remote folder not found for download');
            }

            let fileList = await sftp.list(downloadDirPath);

            if (!fileList.length) {
                sftpService.sendDataError('Files not found in AHS remote folder for download');
            }

            const fileDir = moment().format('YYYY/MM/DD');
            let filePath = root_directory + '/AHS/' + fileDir;

            if (!fs.existsSync(filePath)) {
                await mkdirpAsync(filePath);
            }

            let promises = [];

            promises = _.map(fileList, async (file) => {
                let downloadPath = `${downloadDirPath}/${file.name}`;
                await sftp.fastGet(downloadPath, `${root_directory}/${file.name}`);
                return sftp.delete(downloadPath);
            });

            await Promise.all(promises);

            return {
                err: null,
                response: {
                    status: 'ok',
                    message: 'Files downloaded successfully'
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

        if (action === 'upload') {
            return sftpService.upload(data);
        } else if (action === 'download') {
            return sftpService.download(data);
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
