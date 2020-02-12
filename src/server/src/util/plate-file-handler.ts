import * as formidable from 'formidable';
import * as path from 'path';
import * as Q from "q";
import {Fields} from "formidable";
import {Files} from "formidable";
import * as aws from 'aws-sdk';
import * as fs from 'fs';
import {IUser} from "../models/users";
import {IPlateItem, IFileAttachment} from "../models/plate-item";
import {Config} from "../config/config-service";
import {PlateUtil} from "./plate-util";
import {ITeam} from "../models/teams";
const uuid = require('node-uuid');
const gm = require('gm').subClass({imageMagick: true});

const DEFAULT_THUMBNAIL_SIZE = 80;
const TMP_DIRECTORY = '/tmp/';

export interface FileSystemInfo {
    fileName: string
    key: string
    bytes: number
    thumbnail: string
}

const constants = {
    // The provided keys are for the plate-dev user on AWS
    // plate-dev user only has RW access to plate-dev bucket
    s3Options: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAJZS636WZ5IYGMMIQ',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
    },
    bucketName: process.env.AWS_BUCKET_NAME || Config.Keys.S3_DEV_BUCKET,
    folderName: Config.Keys.S3_ATTACHMENTS_FOLDER
}

class PlateFileHandler {
    s3 = new aws.S3(constants.s3Options);

    private parseFiles(form: formidable.IncomingForm, req): Q.Promise<Files> {
        let deferred = Q.defer<Files>();
        form.parse(req, (err: any, fields: Fields, files: Files) => {
            // ends here
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(files || {});
            }
        });
        return deferred.promise;
    }
    private uploadPlateItemAttachmentToS3(userId: string, plateItemId: string, fileName: string, filePath: string, size: number): Q.Promise<FileSystemInfo> {
        let deferred = Q.defer<FileSystemInfo>();
        const id = uuid.v4();
        const key = `${constants.folderName}/${userId}/${plateItemId}/${id}/${fileName}`;
        const thumbnailKey = `${constants.folderName}/${userId}/${plateItemId}/${id}/thumb_${fileName}`;
        try {
            const body = fs.createReadStream(filePath);
            const params = {
                Bucket: constants.bucketName,
                Key: key,
                Body: body
            };
            (<any>this.s3.upload(params)).
                on('httpUploadProgress', (evt) => {
                    //console.log(evt);
                }).
                send((err, data) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        let extension = PlateUtil.getExtensionForFileName(fileName);
                        if (PlateUtil.extensionIsImage(extension)) {
                            let thumbNailPath = `${TMP_DIRECTORY}/thumb_${fileName}`;
                            gm(filePath)
                                .resize(DEFAULT_THUMBNAIL_SIZE, DEFAULT_THUMBNAIL_SIZE)
                                .noProfile()
                                .write(thumbNailPath, (err) => {
                                    if (err) {
                                        deferred.reject('problem creating thumbnail');
                                    } else {
                                        const thumbnailBody = fs.createReadStream(thumbNailPath);
                                        const thumbnailParams = {
                                            Bucket: constants.bucketName,
                                            Key: thumbnailKey,
                                            Body: thumbnailBody
                                        };
                                        (<any>this.s3.upload(thumbnailParams)).
                                        on('httpUploadProgress', (evt) => {
                                            //console.log(evt);
                                        }).
                                        send((err, data) => {
                                            if (err) {
                                                deferred.reject(err);
                                            } else {
                                                deferred.resolve({
                                                    key: key,
                                                    fileName: fileName,
                                                    bytes: size,
                                                    thumbnail: thumbnailKey
                                                });
                                            }
                                            this.deleteThumbnailInStorage(thumbNailPath);
                                        });
                                    }
                                });
                        } else {
                            deferred.resolve({
                                key: key,
                                fileName: fileName,
                                bytes: size,
                                thumbnail: null
                            });
                        }
                    }
                });
        } catch (e) {
            deferred.reject(e);
        }
        return deferred.promise;
    }
    uploadPlateItemFileAttachments(user: IUser, team: ITeam, plateItem: IPlateItem, req): Q.Promise<FileSystemInfo[]> {
        let deferred = Q.defer<FileSystemInfo[]>();
        if (!plateItem) {
            deferred.reject('Missing plateitem');
        } else {
            let userMaxUploadSize = user.getMaxUploadSize(team);
            let bytesUploadedOnPlateItem = plateItem.getFileAttachmentsSize();
            let sizeLeft = userMaxUploadSize - bytesUploadedOnPlateItem;

            let fileSystemInfos: FileSystemInfo[] = [];
            const form = new formidable.IncomingForm();
            form.multiples = true;
            form.on('file', (field, file) => {
                //console.log('file uploaded');
            });
            form.on('error', function(err) {
                deferred.reject(err);
            });
            form.on('end', function() {
                //deferred.resolve(fileSystemInfos);
            });
            form.on('progress', (bytesReceived: number, bytesExpected: number) => {
                if (bytesReceived > sizeLeft) {
                    deferred.reject('size too big');
                    // Close by emitting an error
                    (<any>form)._error('size too big');
                }
            });
            if (form.bytesExpected > sizeLeft) {
                deferred.reject('size too big');
            } else {
                this.parseFiles(form, req).then((files: Files) => {
                    if (files && Object.keys(files).length) {
                        let sizeAttemptingToUpload = 0;
                        for (let key in files) {
                            sizeAttemptingToUpload += files[key].size;
                        }
                        if (sizeAttemptingToUpload > sizeLeft) {
                            deferred.reject('size too big');
                            this.deleteFilesInStorage(files);
                        } else {
                            let numFilesToUpload = Object.keys(files).length;
                            let numFilesUploaded = 0;
                            for (let key in files) {
                                let file = files[key];
                                let oldName = file.name;
                                let size = file.size;
                                let path = file.path;
                                this.uploadPlateItemAttachmentToS3(user.id, plateItem.id, oldName, path, size).then((fileSystemInfo) => {
                                    fileSystemInfos.push(fileSystemInfo);
                                    numFilesUploaded++;
                                    if (numFilesUploaded >= numFilesToUpload) {
                                        deferred.resolve(fileSystemInfos);
                                        this.deleteFilesInStorage(files);
                                    }
                                }).catch((reason) => {
                                    console.error(reason);
                                    deferred.reject(reason);
                                    this.deleteFilesInStorage(files);
                                });
                            }
                        }
                    } else {
                        deferred.resolve([]);
                    }
                }).catch((reason) => {
                    deferred.reject(reason);
                })
            }
        }
        return deferred.promise;
    }
    deleteFileAttachment(fileAttachment: IFileAttachment) {
        let deferred = Q.defer<boolean>();
        let link = fileAttachment.link;
        let key = Config.keyFromS3Link(link);
        this.s3.deleteObject({
            Bucket: constants.bucketName,
            Key: key
        }, (err, data) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(true)
            }
        });
        return deferred.promise;
    }
    private deleteFilesInStorage(files: Files) {
        if (files && Object.keys(files).length) {
            try {
                for (let key in files) {
                    let file = files[key];
                    let path = file.path;
                    fs.unlink(path, (err) => {
                        if (err) {
                            console.error('error in removing uploaded file');
                            console.error(err);
                        }
                    });
                }
            } catch (e) {
                console.error('error in removing uploaded files');
                console.error(e);
            }
        }
    }
    private deleteThumbnailInStorage(filePath: string) {
        if (filePath) {
            try {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('error in removing thumbnail file');
                        console.error(err);
                    }
                });
            } catch (e) {
                console.error('error in removing thumbnail file');
                console.error(e);
            }
        }
    }

}

export const plateFileHandler = new PlateFileHandler();