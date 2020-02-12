import * as mongoose from "mongoose";
import * as Q from "q";
import {IUser, User} from "./users";
import {Plate, IPlate, IPlateHeader} from "./plates";
import {ServerConnectedAppType} from "./connectedapps";
import {Team, IMetricDefinition, DEFAULT_METRIC_VALUES, PERMISSION_KEYS} from "./teams";
import {Activity, ServerActivityActionType} from "./activity";
import {IPlatter} from "./platters";
import {PlateUtil} from "../util/plate-util";
import {FileSystemInfo} from "../util/plate-file-handler";
import {Config} from "../config/config-service";

export interface SimplePlateSearchResultsWithSize {
    results: ISimplePlateItem[];
    resultSizeEstimate: number;
}
export interface PlateSearchResultsWithSize {
    results: IPlateItem[];
    resultSizeEstimate: number;
}

const enum PlateItemStatus {
    Open,
    Done
}

const enum MetricOwnerType {
    User,
    Team
}

export interface IMetric {
    owner: string,
    ownerType: MetricOwnerType,
    value: string,
    name: string // Convenience - the real metric name will exist on the team / user
}

export interface ISimpleMetric {
    owner: string,
    ownerType: MetricOwnerType,
    value: string,
    name: string
}

export interface IFileAttachment {
    id?: string
    created?: number
    addedBy?: string
    item?: string
    isExternal?: boolean
    link?: string
    connectedApp?: string
    connectedAppItemId?: string
    fileName?: string
    bytes?: number
    thumbnail?: string
}
export interface ISimpleFileAttachment {
    id?: string
    created?: number
    addedBy?: string
    item?: string
    isExternal?: boolean
    link?: string
    connectedApp?: string
    connectedAppItemId?: string
    fileName?: string
    bytes?: number
    thumbnail?: string
}

export interface IConnectedAppAttachment {
    // Immutable:
    app: ServerConnectedAppType,
    created?: number,

    // Shows up in UI:
    title: string,
    subtitle: string,
    content: string,

    identifier: string,
    connectedAppId: string,
    itemDate: number,

    // Custom:
    customIds: string[],
    customDates: string[],
    customDetails: string[]
}

export interface ISimpleConnectedAppAttachment {
    id?: string;
    app: ServerConnectedAppType,
    created?: number,

    title: string,
    subtitle: string,
    content: string,

    identifier: string,
    connectedAppId: string,
    itemDate: number,

    customIds: string[],
    customDates: string[],
    customDetails: string[]
}

export interface ISimplePlateItem {
    id: string;
    owner: string;
    title: string;
    header: string;
    plate: string;
    connectedAppAttachments: ISimpleConnectedAppAttachment[];
    pos: number;
    previousHeader: string;
    previousPlate: string;
    tags: string[];
    markedDone: boolean;
    assignees: string[];
    due: number;
    created: number;
    modified: number;
    numComments: number;
    archived: boolean;
    metrics: ISimpleMetric[];
    fileAttachments: ISimpleFileAttachment[];
}
export interface IPlateItem extends mongoose.Document {
    id?: string;
    owner: string;
    title: string;
    header: string;
    previousHeader: string;
    assignees: string[];
    plate: string;
    previousPlate: string;
    numNotifiedDue: number;
    connectedAppAttachments: IConnectedAppAttachment[];
    pos: number;
    tags: string[];
    markedDone: boolean;
    due: number;
    created: number;
    modified: number;
    numComments: number;
    archived: boolean;
    metrics: IMetric[];
    fileAttachments: IFileAttachment[];
}
export interface IPlateItemStatic extends mongoose.Model<IPlateItem> {}

let PlateItemSchema = new mongoose.Schema({
    owner: mongoose.Schema.Types.ObjectId,
    title: String,
    tags: [mongoose.Schema.Types.ObjectId],
    connectedAppAttachments: [{
        app: Number,
        created: {
            type: Date,
            default: Date.now
        },
        title: String,
        subtitle: String,
        content: String,
        identifier: String,
        connectedAppId: String,
        itemDate: Number,
        customIds: [String],
        customDates: [String],
        customDetails: [String]
    }],
    numComments: {
        type: Number,
        default: 0
    },
    assignees: [mongoose.Schema.Types.ObjectId],
    numNotifiedDue: {
        type: Number,
        default: 0
    },
    archived: {
        type: Boolean,
        default: false
    },
    metrics: [{
        foreignId: mongoose.Schema.Types.ObjectId,
        owner: mongoose.Schema.Types.ObjectId,
        ownerType: Number,
        value: String,
        name: String
    }],
    fileAttachments: [
        {
            created: {
                type: Date,
                default: Date.now
            },
            addedBy: mongoose.Schema.Types.ObjectId,
            item: mongoose.Schema.Types.ObjectId,
            isExternal: {
                type: Boolean,
                default: false
            },
            link: String,
            connectedApp: String,
            connectedAppItemId: String,
            fileName: String,
            bytes: {
                type: Number,
                default: 0
            },
            thumbnail: String
        }
    ],
    plate: mongoose.Schema.Types.ObjectId,
    header: mongoose.Schema.Types.ObjectId,
    previousHeader: mongoose.Schema.Types.ObjectId, // For when it's marked done
    previousPlate: mongoose.Schema.Types.ObjectId, // For when it's marked done
    pos: Number,
    markedDone: {
        type: Boolean
    },
    due: {
        type: Date
    },
    created: {
        type: Date,
        default: Date.now
    },
    modified: {
        type: Date,
        default: Date.now
    }
});

// Add the index for text search - (note - we're actually using regex)
//PlateItemSchema.index({ title: 'text' });

export interface IPlateItemStatic{ getItemsForPlate(plate: IPlate): Q.Promise<IPlateItem[]> }
PlateItemSchema.statics.getItemsForPlate = function(plate: IPlate): Q.Promise<IPlateItem[]> {
    let deferred = Q.defer<IPlateItem[]>();

    PlateItem.find({
        'plate': plate.id,
        archived: {
            $ne: true
        }
    }, function(err, plateItems) {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(plateItems);
        }
    });

    return deferred.promise;
}

export interface IPlateItemStatic{ VerifyParameters(plateItem: ISimplePlateItem): string }
PlateItemSchema.statics.VerifyParameters = function(plateItem: ISimplePlateItem): string {
    return null;
}

export interface IPlateItemStatic{ getByIdForUser(id: string, user: IUser): Q.Promise<[IPlatter, IPlate, IPlateItem]> }
PlateItemSchema.statics.getByIdForUser = function(id: string, user: IUser): Q.Promise<[IPlatter, IPlate, IPlateItem]> {
    let deferred = Q.defer<[IPlatter, IPlate, IPlateItem]>();
    this.findById(id, (err, plateItem) => {
        if (err) {
            deferred.reject('error in getting plate item by id');
        } else {
            Plate.getByIdForUser(user, plateItem.plate).then(([plate, platter]) => {
                // User has access to plate
                deferred.resolve([platter, plate, plateItem]);
            }).catch((reason) => {
                deferred.reject('User does not have access for plate item');
            })
        }
    })
    return deferred.promise;
}

export interface IPlateItemStatic{ createPlateItemForUser(plate: IPlate, platter: IPlatter, itemDetails: ISimplePlateItem, user: IUser): Q.Promise<[IPlateItem, IPlate]> }
PlateItemSchema.statics.createPlateItemForUser = function(plate: IPlate, platter: IPlatter, itemDetails: ISimplePlateItem, user: IUser): Q.Promise<[IPlateItem, IPlate]> {
    let deferred = Q.defer<[IPlateItem, IPlate]>();

    platter.checkPermission(user, PERMISSION_KEYS.CREATE_PLATE_ITEMS).then((platter) => {
        let plateItem: IPlateItem = new PlateItem();
        plateItem.title = itemDetails.title;
        plateItem.owner = user.id;
        plateItem.header = itemDetails.header;
        plateItem.plate = plate.id;
        plateItem.pos = itemDetails.pos;

        if (itemDetails.connectedAppAttachments) {
            plateItem.connectedAppAttachments = itemDetails.connectedAppAttachments;
        }

        let foundHeader = false;
        for (let header of plate.headers) {
            if (header.id === itemDetails.header) {
                foundHeader = true;
                break;
            }
        }
        if (!foundHeader) {
            deferred.reject('Could not find header on plate');
        } else {
            plateItem.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    internalUpdatePositions(PositionUpdateOperation.Add, plateItem.plate, plateItem.header, plateItem.pos, plateItem._id).then((num) => {
                        deferred.resolve([plateItem, plate]);
                        Activity.createActivity(plate.id, platter, user, plateItem.id, platter.team, ServerActivityActionType.CreatePlateItem, plate.color, plateItem.title, plate.name);
                    }).catch((reason) => {
                        deferred.reject(err);
                    });
                }
            })
        }
    }).catch((reason) => {
        deferred.reject('User does not have perimssion')
    })

    return deferred.promise;
}

export interface IPlateItemStatic{ createPlateItemFromAutomationRule(user: IUser, plate: IPlate, headerId: string, title: string, connectedAppAttachments: IConnectedAppAttachment[]): Q.Promise<ISimplePlateItem> }
PlateItemSchema.statics.createPlateItemFromAutomationRule = function(user: IUser, plate: IPlate, headerId: string, title: string, connectedAppAttachments: IConnectedAppAttachment[]): Q.Promise<ISimplePlateItem> {
    let deferred = Q.defer<ISimplePlateItem>();

    let plateItem: IPlateItem = new PlateItem();
    plateItem.title = title;
    plateItem.owner = user.id;

    headerId = headerId || plate.headers[0].id;
    plateItem.header = headerId;
    plateItem.plate = plate.id;
    plateItem.pos = 0;

    if (connectedAppAttachments) {
        plateItem.connectedAppAttachments = connectedAppAttachments;
    }

    let foundHeader = false;
    for (let header of plate.headers) {
        if (header.id === headerId.toString()) {
            foundHeader = true;
            break;
        }
    }
    if (!foundHeader) {
        deferred.reject('Could not find header on plate');
    } else {
        plateItem.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                internalUpdatePositions(PositionUpdateOperation.Add, plateItem.plate, plateItem.header, plateItem.pos, plateItem._id).then((num) => {
                    deferred.resolve(plateItem.simple());
                    //Activity.createActivity(plate.id, platter.id, user, plateItem.id, platter.team, ServerActivityActionType.CreatePlateItem, plate.color, plateItem.title, plate.name);
                }).catch((reason) => {
                    deferred.reject(err);
                });
            }
        })
    }

    return deferred.promise;
}

export interface IPlateItemStatic{ getAllDueSoonThatNeedNotifications(): Q.Promise<IPlateItem[]> }
PlateItemSchema.statics.getAllDueSoonThatNeedNotifications = function(): Q.Promise<IPlateItem[]> {
    let deferred = Q.defer<IPlateItem[]>();
    let now = Date.now();
    let tomorrow = now + 24*60*60*1000;
    PlateItem.find({
        due: {
            $ne: null,
            $lt: tomorrow
        },
        numNotifiedDue: {
            $lt: 3
        },
        markedDone: {
            $ne: true
        }
    }).exec((err, plateItems) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(plateItems);
        }
    });
    return deferred.promise;
}

export interface IPlateItemStatic{ search(user: IUser, query: string, maxResults: number): Q.Promise<PlateSearchResultsWithSize> }
PlateItemSchema.statics.search = function(user: IUser, query: string, maxResults: number): Q.Promise<PlateSearchResultsWithSize> {
    let deferred = Q.defer<PlateSearchResultsWithSize>();
    // plate item -> owner == me <-- not implemented atm and not sure that we will
    // or plate item -> plate -> owner == me
    // or plate item -> plate -> teams _contain_ one of my teams

    maxResults = +maxResults || 5;
    if (maxResults > 20) {
        maxResults = 20;
    }
    if (maxResults < 1) {
        maxResults = 1;
    }

    Plate.getAllForUser(user).then((plates) => {
        let plateIdsArray = [];
        for (let plate of plates)
            plateIdsArray.push(plate.id);

        let queryRegExpString = '';
        for (let token of query.split(' ')) {
            queryRegExpString += `(?=.*${token})`;
        }

        PlateItem.find(
            {
                plate: { $in: plateIdsArray },
                title: new RegExp(`\\b${queryRegExpString}.*$`, 'gim')
            }
        )
            .sort({'created': -1})
            .exec(function(err, results: IPlateItem[]) {
                if (err) {
                    deferred.reject(err);
                } else {
                    // Only return X amount.
                    // Later we may run into problems (RAM wise and performance) if this is returning a huge number of items
                    // But do it like this for now
                    // The other option seems to be to .limit(5) and then do a separate DB query for find().count()
                    let num = results && results.length;
                    let firstXResults = results && results.slice(0, maxResults) || [];
                    deferred.resolve({
                        results: results,
                        resultSizeEstimate: num
                    });
                }
            });

    }).catch((reason) => {
        deferred.reject(reason);
    })

    return deferred.promise;
}

export interface IPlateItemStatic{ defaultPlateItems(plate: IPlate, user: IUser, isTeam?: boolean): Q.Promise<IPlateItem[]> }
PlateItemSchema.statics.defaultPlateItems = function(plate: IPlate, user: IUser, isTeam?: boolean): Q.Promise<IPlateItem[]> {
    let deferred = Q.defer<IPlateItem[]>();

    if (!isTeam) {
        let item1 = new PlateItem();
        item1.owner = user.id;
        item1.plate = plate.id;
        item1.header = plate.headers[0].id;
        item1.pos = 0;
        item1.title = 'Welcome to Plate Early Access! We hope you like it here.';

        let item2 = new PlateItem();
        item2.owner = user.id;
        item2.plate = plate.id;
        item2.header = plate.headers[0].id;
        item2.pos = 1;
        item2.title = 'Try clicking this item to edit it. Right now, items can have due dates and comments.';

        let item3 = new PlateItem();
        item3.owner = user.id;
        item3.plate = plate.id;
        item3.header = plate.headers[0].id;
        item3.pos = 2;
        item3.title = 'You can click the circle to mark an item item as Done, and you can drag and drop any item to any other Plate.';

        let item4 = new PlateItem();
        item4.owner = user.id;
        item4.plate = plate.id;
        item4.header = plate.headers[1].id;
        item4.pos = 0;
        item4.title = 'Hide and show Plates by clicking on them in the sidebar.';

        let item5 = new PlateItem();
        item5.owner = user.id;
        item5.plate = plate.id;
        item5.header = plate.headers[1].id;
        item5.pos = 1;
        item5.title = 'Click the + icon in the top bar. Make a new team and invite members by email. Teams have their own Plates.';

        let item6 = new PlateItem();
        item6.owner = user.id;
        item6.plate = plate.id;
        item6.header = plate.headers[1].id;
        item6.pos = 2;
        item6.title = 'Connect a Gmail or Slack account in the sidebar and quickly create or link Plate items from that account.';

        let item7 = new PlateItem();
        item7.owner = user.id;
        item7.plate = plate.id;
        item7.header = plate.headers[1].id;
        item7.pos = 3;
        item7.title = 'Last thing: you can search across all of your Plates AND connected apps. (More connected apps coming soon!)';

        // Definitely could use some work
        item1.save((err) => {
            if (err) { deferred.reject(err); return; }

            item2.save((err) => {
                if (err) { deferred.reject(err); return; }

                item3.save((err) => {
                    if (err) { deferred.reject(err); return; }

                    item4.save((err) => {
                        if (err) { deferred.reject(err); return; }

                        item5.save((err) => {
                            if (err) { deferred.reject(err); return; }

                            item6.save((err) => {
                                if (err) { deferred.reject(err); return; }

                                item7.save((err) => {
                                    if (err) { deferred.reject(err); return; }

                                    deferred.resolve([item1, item2, item3, item4, item5, item6, item7]);
                                });
                            });
                        });
                    });
                });
            });
        });

    } else {
        let item1 = new PlateItem();
        item1.owner = user.id;
        item1.plate = plate.id;
        item1.header = plate.headers[0].id;
        item1.pos = 0;
        item1.title = 'Members of your team can see items on this Plate.';

        let item2 = new PlateItem();
        item2.owner = user.id;
        item2.plate = plate.id;
        item2.header = plate.headers[0].id;
        item2.pos = 1;
        item2.title = 'When you mark this done, it’s done for your entire team.';

        let item3 = new PlateItem();
        item3.owner = user.id;
        item3.plate = plate.id;
        item3.header = plate.headers[1].id;
        item3.pos = 0;
        item3.title = 'Comments can be seen by anyone on your team.';

        let item4 = new PlateItem();
        item4.owner = user.id;
        item4.plate = plate.id;
        item4.header = plate.headers[1].id;
        item4.pos = 1;
        item4.title = 'Members will see changes to these items in real time.';

        // Definitely could use some work
        item1.save((err) => {
            if (err) { deferred.reject(err); return; }

            item2.save((err) => {
                if (err) { deferred.reject(err); return; }

                item3.save((err) => {
                    if (err) { deferred.reject(err); return; }

                    item4.save((err) => {
                        if (err) { deferred.reject(err); return; }

                        deferred.resolve([item1, item2, item3, item4]);
                    });
                });
            });
        });
    }

    return deferred.promise;
}

export interface IPlateItem{ getFileAttachmentsSize      (): number }
PlateItemSchema.methods.getFileAttachmentsSize = function(): number {
    const thisPlateItem: IPlateItem = this;
    let fileAttachments = thisPlateItem.fileAttachments;
    if (fileAttachments && fileAttachments.length) {
        let size = 0;
        for (let fileAttachment of fileAttachments) {
            size += fileAttachment.bytes;
        }
        return size;
    } else {
        return 0;
    }
}

export interface IPlateItem{ updatePosition      (user: IUser, newPosition: number, newHeader: string, markedDone: boolean, plate: IPlate, platter: IPlatter): Q.Promise<IPlateItem> }
PlateItemSchema.methods.updatePosition = function(user: IUser, newPosition: number, newHeader: string, markedDone: boolean,  plate: IPlate, platter: IPlatter): Q.Promise<IPlateItem> {
    /*
    Tests:
      - Move item up in same header from 2 to 1 `
      - Move item up in same header from last to 1 `
      - Move item up in same header from 2 to 0 `
      - Move item up in same header from last to 0 `
      - Move item down in same header from 1 to 2 `
      - Move item down in same header from first to 2 `
      - Move item down in same header from 1 to last `
      - Move item down in same header from first to last `
      - Move item from one header to another - 1 to 1 `
      - Move item from one header to another - 1 to 0 `
      - Move item from one header to another - 1 to last `
      - Move item from one header to another - last to 1 `
      - Move item from one header to another - 0 to 1 `
     */
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;
    const oldPosition = thisPlateItem.pos;
    const oldHeader = thisPlateItem.header;
    const headerIsDifferent = oldHeader !== newHeader;
    thisPlateItem.pos = newPosition;
    if (newHeader && headerIsDifferent) {
        thisPlateItem.previousHeader = thisPlateItem.header;
        thisPlateItem.header = newHeader;
    }
    if (PlateUtil.IsDefined(markedDone)) {
        if (thisPlateItem.markedDone !== markedDone) {
            thisPlateItem.markedDone = markedDone;
        }
    }
    thisPlateItem.save(function(err) {
        if (err) {
        	deferred.reject('error in saving plate item position');
        } else {
            if (newHeader && headerIsDifferent) {
                // The header is updated. Need to update the pos of the new header

                internalUpdatePositions(PositionUpdateOperation.Add, thisPlateItem.plate, newHeader, newPosition, thisPlateItem._id).then((num) => {
                	internalUpdatePositions(PositionUpdateOperation.Remove, thisPlateItem.plate, oldHeader, oldPosition, thisPlateItem._id).then((num) => {
                        deferred.resolve(thisPlateItem);
                        for (let header of plate.headers) {
                            if (header.id === newHeader && header.isDoneHeader) {
                                Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.MarkAsDonePlateItem, plate.color, thisPlateItem.title, plate.name);
                                break;
                            }
                        }
                	}).catch((reason) => {
                        deferred.reject(reason);
                	})
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            } else {
                if (oldPosition < newPosition) {
                    // It moved down. Decrease all pos's from old to new
                    internalUpdatePositions(PositionUpdateOperation.MoveDown, thisPlateItem.plate, thisPlateItem.header, oldPosition, thisPlateItem._id, newPosition).then((num) => {
                        deferred.resolve(thisPlateItem);
                    }).catch((reason) => {
                        deferred.reject(reason);
                    });
                } else if (oldPosition > newPosition) {
                    // It moved up. Increase all pos from new to old
                    internalUpdatePositions(PositionUpdateOperation.MoveUp, thisPlateItem.plate, thisPlateItem.header, newPosition, thisPlateItem._id, oldPosition).then((num) => {
                        deferred.resolve(thisPlateItem);
                    }).catch((reason) => {
                        deferred.reject(reason);
                    });
                }

            }
        }
    });

    return deferred.promise;
}

export interface IPlateItem{ deleteConnectedAppAttachment      (attachmentId: string): Q.Promise<IPlateItem> }
PlateItemSchema.methods.deleteConnectedAppAttachment = function(attachmentId: string): Q.Promise<IPlateItem> {
    let deferred = Q.defer<IPlateItem>();
    let thisPlateItem: IPlateItem = this;
    let attachments = thisPlateItem.connectedAppAttachments;
    for (let i=0; i < attachments.length; i++) {
        let attachment = attachments[i];
        if ((<any>attachment).id === attachmentId) {
            attachments.splice(i, 1);
            break;
        }
    }
    thisPlateItem.save((err) => {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(thisPlateItem);
        }
    })
    return deferred.promise;
}

export interface IPlateItem{ deleteFileAttachment      (attachmentId: string): Q.Promise<IFileAttachment> }
PlateItemSchema.methods.deleteFileAttachment = function(attachmentId: string): Q.Promise<IFileAttachment> {
    let deferred = Q.defer<IFileAttachment>();
    let thisPlateItem: IPlateItem = this;
    let attachments = thisPlateItem.fileAttachments;
    let deletedFileAttachment: IFileAttachment = null;
    for (let i=0; i < attachments.length; i++) {
        let attachment = attachments[i];
        if ((<any>attachment).id === attachmentId) {
            deletedFileAttachment = attachment;
            attachments.splice(i, 1);
            break;
        }
    }
    thisPlateItem.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(deletedFileAttachment);
        }
    })
    return deferred.promise;
}

export interface IPlateItem{ setDueNotifiedNum      (num: number): void }
PlateItemSchema.methods.setDueNotifiedNum = function(num: number): void {
    const thisPlateItem: IPlateItem = this;
    if (thisPlateItem.numNotifiedDue !== num) {
        thisPlateItem.numNotifiedDue = num;
        thisPlateItem.save((err) => {
            if (err) {
                console.error('error in set plate item num notified due');
            } else {
                // Do nothing
            }
        })
    }
}

export interface IPlateItem{ addFileAttachments      (user: IUser, fileSystemInfos: FileSystemInfo[]): Q.Promise<ISimpleFileAttachment[]> }
PlateItemSchema.methods.addFileAttachments = function(user: IUser, fileSystemInfos: FileSystemInfo[]): Q.Promise<ISimpleFileAttachment[]> {
    let deferred = Q.defer<IFileAttachment[]>();
    const thisPlateItem: IPlateItem = this;

    let fileAttachmentLinksToResolve: string[] = [];
    for (let fileSystemInfo of fileSystemInfos) {
        let fileAttachment: IFileAttachment = {
            addedBy: user.id,
            item: thisPlateItem.id,
            link: Config.getS3Url() + fileSystemInfo.key,
            fileName: fileSystemInfo.fileName,
            bytes: fileSystemInfo.bytes,
            thumbnail: fileSystemInfo.thumbnail ? Config.getS3Url() + fileSystemInfo.thumbnail : null
        }
        thisPlateItem.fileAttachments.push(fileAttachment);
        fileAttachmentLinksToResolve.push(fileAttachment.link);
    }

    thisPlateItem.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            let fileAttachmentsToResolve = [];
            for (let attachment of thisPlateItem.fileAttachments) {
                if (fileAttachmentLinksToResolve.indexOf(attachment.link) > -1) {
                    fileAttachmentsToResolve.push(attachment);
                }
            }
            let simpleAttachments = simpleFileAttachments(fileAttachmentsToResolve);
            deferred.resolve(simpleAttachments);
        }
    })

    return deferred.promise;
}

export interface IPlateItem{ getAttachmentById      (id: string): IFileAttachment }
PlateItemSchema.methods.getAttachmentById = function(id: string): IFileAttachment {
    let thisPlateItem: IPlateItem = this;
    for (let attachment of thisPlateItem.fileAttachments) {
        if (attachment.id === id) {
            return attachment;
        }
    }
}


export interface IPlateItem{ createOrUpdateMetric      (metricBody: ISimpleMetric, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> }
PlateItemSchema.methods.createOrUpdateMetric = function(metricBody: ISimpleMetric, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> {
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;
    let validated = true;
    // This is a metric created on the fly or accessed via name
    if (!metricBody.name) {
        deferred.reject('No metric id or name given');
        validated = false;
    } else if (metricBody.name.length > 50) {
        deferred.reject('Metric name too long');
        validated = false;
    } else if (!metricBody.owner) {
        deferred.reject('No metric owner given');
        validated = false;
    } else if (metricBody.ownerType !== MetricOwnerType.Team && metricBody.ownerType !== MetricOwnerType.User) {
        deferred.reject('Metric owner type not valid');
        validated = false;
    } else if (metricBody.value && DEFAULT_METRIC_VALUES.indexOf(metricBody.value) === -1) {
        // For now check that the metric belongs to the default metrics or is empty
        // The value is allowed to be undefined
        deferred.reject('Value not valid');
        validated = false;
    } else if (thisPlateItem.metrics.length > 20) {
        deferred.reject('Item has too many metrics');
        validated = false;
    }

    if (validated) {
        // First check to see if this metric exists
        let foundMetric: IMetric = null;
        for (let metric of thisPlateItem.metrics) {
            if (metric.name === metricBody.name) {
                foundMetric = metric;
                break;
            }
        }

        if (foundMetric) {
            foundMetric.value = metricBody.value;
            thisPlateItem.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(thisPlateItem);
                    Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.ChangePlateItemMetric, plate.color, foundMetric.name, thisPlateItem.title, foundMetric.value);
                }
            });
        } else {
            // Creating a new metric
            if (metricBody.ownerType === MetricOwnerType.Team) {
                Team.getByIdForUser(metricBody.owner, user).then((team) => {
                    team.createOrGetNewMetricDefinitionForMetric(metricBody).then((metricDefinition: IMetricDefinition) => {
                        let newMetric: IMetric = {
                            owner: team.id,
                            ownerType: MetricOwnerType.Team,
                            value: metricBody.value,
                            name: metricBody.name
                        }
                        thisPlateItem.metrics.push(newMetric);
                        thisPlateItem.save((err) => {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                deferred.resolve(thisPlateItem);
                                Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.ChangePlateItemMetric, plate.color, newMetric.name, thisPlateItem.title, newMetric.value);
                            }
                        });
                    }).catch((reason) => {
                        deferred.reject(reason);
                    });
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            } else if (metricBody.ownerType === MetricOwnerType.User) {
                user.createOrGetNewMetricDefinitionForMetric(metricBody).then((metricDefinition: IMetricDefinition) => {
                    let newMetric: IMetric = {
                        owner: user.id,
                        ownerType: MetricOwnerType.User,
                        value: metricBody.value,
                        name: metricBody.name
                    }
                    thisPlateItem.metrics.push(newMetric);
                    thisPlateItem.save((err) => {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(thisPlateItem);
                            Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.ChangePlateItemMetric, plate.color, newMetric.name, thisPlateItem.title, newMetric.value);
                        }
                    });
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            }
        }
    }

    return deferred.promise;
}

export interface IPlateItem{ addAssignee      (memberId: string, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> }
PlateItemSchema.methods.addAssignee = function(memberId: string, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> {
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;
    User.isUserIdMemberOfTeam(memberId, platter.team && platter.team.toString()).then((member) => {
        let foundDuplicateAssignee = false;
        for (let assigneeId of thisPlateItem.assignees) {
            if (assigneeId.toString() === memberId) {
                foundDuplicateAssignee = true;
                break;
            }
        }

        if (foundDuplicateAssignee) {
            deferred.resolve(thisPlateItem);
        } else {
            thisPlateItem.assignees.push(memberId);
            thisPlateItem.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(thisPlateItem);
                }
            })
        }
    }).catch((reason) => {
        deferred.reject(reason);
    })
    return deferred.promise;
}

export interface IPlateItem{ removeAssignee      (memberId: string, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> }
PlateItemSchema.methods.removeAssignee = function(memberId: string, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> {
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;

    let didRemove = false;
    for (let i = 0; i < thisPlateItem.assignees.length; i++) {
        let assigneeId = thisPlateItem.assignees[i];
        if (assigneeId.toString() === memberId) {
            thisPlateItem.assignees.splice(i, 1);
            didRemove = true;
            break;
        }
    }

    if (!didRemove) {
        deferred.resolve(thisPlateItem);
    } else {
        thisPlateItem.save((err) => {
            if (err) {
            	deferred.reject(err);
            } else {
                deferred.resolve(thisPlateItem);
            }
        })
    }

    return deferred.promise;
}

export interface IPlateItem{ updatePlateItem      (newDetails: ISimplePlateItem, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> }
PlateItemSchema.methods.updatePlateItem = function(newDetails: ISimplePlateItem, user: IUser, platter: IPlatter, plate: IPlate): Q.Promise<IPlateItem> {
    /*
     Tests:
     - Move item from:
       - 0 to 0 `
       - 0 to 1 `
       - 0 to last `
       - Last to 0 `
       - Last to 1 `
       - Last to last `
       - 1 to 1 `
       - 1 to Last `
       - 1 to 0 `
     */
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;

    if (newDetails.plate) {
        if (newDetails.plate === thisPlateItem.plate.toString()) {
            // Regular update

            let somethingChanged = false;
            let didArchive = false;
            if (newDetails.title) {
                if (thisPlateItem.title !== newDetails.title) {
                    let originalTitle = thisPlateItem.title;
                    thisPlateItem.title = newDetails.title;
                    Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.EditPlateItemTitle, plate.color, thisPlateItem.title, plate.name, originalTitle);
                    somethingChanged = true;
                }
            }

            if (newDetails.connectedAppAttachments && newDetails.connectedAppAttachments.length !== thisPlateItem.connectedAppAttachments.length) {
                // For now we will just focus on adding one at a time
                let attachmentToAdd: ISimpleConnectedAppAttachment = null;
                for (let attachment of newDetails.connectedAppAttachments) {
                    if (!attachment.id) {
                        attachmentToAdd = attachment;
                        break;
                    }
                }
                thisPlateItem.connectedAppAttachments.push(attachmentToAdd);
                somethingChanged = true;

                let activityType: ServerActivityActionType = null;
                if (attachmentToAdd.app === ServerConnectedAppType.Gmail) {
                    activityType = ServerActivityActionType.AttachGmail;
                } else if (attachmentToAdd.app === ServerConnectedAppType.Slack) {
                    activityType = ServerActivityActionType.AttachSlack;
                }
                Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, activityType, plate.color, thisPlateItem.title, plate.name, `${attachmentToAdd.title} - ${attachmentToAdd.subtitle}`);
            }

            if (newDetails.archived === true) {
                if (thisPlateItem.archived !== newDetails.archived) {
                    thisPlateItem.archived = newDetails.archived;
                    somethingChanged = true;
                    didArchive = true;
                }
            }

            if (PlateUtil.IsDefined(newDetails.markedDone)) {
                if (thisPlateItem.markedDone !== newDetails.markedDone) {
                    thisPlateItem.markedDone = newDetails.markedDone;
                    somethingChanged = true;
                }
            }

            // TODO: This is not quite correct - it assumes that archive and a modify are not done at the same time. Archive takes precedence
            let permissionKey = didArchive ? PERMISSION_KEYS.ARCHIVE_PLATE_ITEMS : PERMISSION_KEYS.MODIFY_PLATE_ITEMS;
            platter.checkPermission(user, permissionKey).then((platter) => {
                if (somethingChanged) {
                    thisPlateItem.save(function(err) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            // Update positions if archived
                            if (didArchive) {
                                internalUpdatePositions(PositionUpdateOperation.Remove, thisPlateItem.plate, thisPlateItem.header, thisPlateItem.pos, thisPlateItem._id).then((num) => {
                                    deferred.resolve(thisPlateItem);
                                }).catch((reason) => {
                                    deferred.reject(reason);
                                });
                                Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.ArchivePlateItem, plate.color, thisPlateItem.title, plate.name);
                            } else {
                                deferred.resolve(thisPlateItem);
                            }
                        }
                    })
                } else {
                    deferred.resolve(thisPlateItem);
                }
            }).catch((reason) => {
                deferred.reject('User does not have permission');
            })

        } else {
            // Moving to diff plates
            // Note that right now, if we move an item to another Plate, we don't simultaneously update other properties on the item
            platter.checkPermission(user, PERMISSION_KEYS.MOVE_PLATE_ITEMS_TO_DIFF).then((platter) => {
                if (!newDetails.header || (newDetails.pos === undefined || newDetails.pos === null)) {
                    deferred.reject('Header and pos must be supplied along with plate');
                    return;
                }

                if (PlateUtil.IsDefined(newDetails.markedDone)) {
                    if (thisPlateItem.markedDone !== newDetails.markedDone) {
                        thisPlateItem.markedDone = newDetails.markedDone;
                    }
                }

                // Verify user has access to new Plate
                Plate.getByIdForUser(user, newDetails.plate).then(([plate, platter]) => {
                    let oldHeader = thisPlateItem.header;
                    let oldPlate = thisPlateItem.plate;
                    let oldPosition = thisPlateItem.pos;

                    thisPlateItem.previousHeader = thisPlateItem.header;
                    thisPlateItem.previousPlate = thisPlateItem.plate;
                    thisPlateItem.header = newDetails.header;
                    thisPlateItem.plate = newDetails.plate;
                    thisPlateItem.pos = newDetails.pos;

                    thisPlateItem.save(function(err) {
                        if (err) {
                            deferred.reject('Error in moving Plate item to another Plate');
                        } else {
                            internalUpdatePositions(PositionUpdateOperation.Add, thisPlateItem.plate, thisPlateItem.header, thisPlateItem.pos, thisPlateItem._id).then((num) => {
                                internalUpdatePositions(PositionUpdateOperation.Remove, oldPlate, oldHeader, oldPosition, thisPlateItem._id).then((num) => {
                                    deferred.resolve(thisPlateItem);
                                    Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, ServerActivityActionType.MovePlateItem, plate.color, thisPlateItem.title, plate.name);
                                }).catch((reason) => {
                                    deferred.reject(reason);
                                })
                            }).catch((reason) => {
                                deferred.reject(reason);
                            });
                        }
                    });
                }).catch((reason) => {
                    deferred.reject('User does not have access to Plate')
                });
            }).catch((reason) => {
                deferred.reject('User does not have permission');
            })
        }
    }

    return deferred.promise;
}

export interface IPlateItem{ changeDueDate      (user: IUser, platter: IPlatter, plate: IPlate, due: number): Q.Promise<IPlateItem> }
PlateItemSchema.methods.changeDueDate = function(user: IUser, platter: IPlatter, plate: IPlate, due: number): Q.Promise<IPlateItem> {
    let deferred = Q.defer<IPlateItem>();
    const thisPlateItem: IPlateItem = this;
    if (new Date(thisPlateItem.due).getTime() !== new Date(due).getTime()) {
        let activityType: ServerActivityActionType = null;
        let activityDetail3 = null;
        let removedDueDate = false;
        if (!thisPlateItem.due) {
            activityType = ServerActivityActionType.CreateDueDate;
            activityDetail3 = due;
        } else {
            if (due) {
                activityType = ServerActivityActionType.ChangeDueDate;
                activityDetail3 = due;
            } else {
                removedDueDate = true;
                activityType = ServerActivityActionType.RemoveDueDate;
            }
        }
        thisPlateItem.due = due;

        const now = Date.now();
        const thirtyMinutesFromNow = now + 30*60*1000;
        const tomorrow = now + 24*60*60*1000;

        if (removedDueDate) {
            thisPlateItem.numNotifiedDue = 0;
        } else if (due < now) {
            thisPlateItem.numNotifiedDue = 3;
        } else if (due < thirtyMinutesFromNow) {
            thisPlateItem.numNotifiedDue = 2;
        } else if (due < tomorrow) {
            thisPlateItem.numNotifiedDue = 1;
        } else {
            thisPlateItem.numNotifiedDue = 0;
        }

        Activity.createActivity(plate.id, platter, user, thisPlateItem.id, platter.team, activityType, plate.color, thisPlateItem.title, plate.name, activityDetail3);
        thisPlateItem.save(function(err) {
            if (err) {
                deferred.reject('Error in changing due date');
            } else {
                deferred.resolve(thisPlateItem);
            }
        });
    } else {
        deferred.resolve(thisPlateItem);
    }
    return deferred.promise;
}

export interface IPlateItem{ simple      (): ISimplePlateItem }
PlateItemSchema.methods.simple = function(): ISimplePlateItem {
    let thisPlateItem: IPlateItem = this;
    return {
        id: <string>thisPlateItem.id,
        owner: thisPlateItem.owner,
        pos: thisPlateItem.pos,
        plate: thisPlateItem.plate,
        header: thisPlateItem.header,
        title: thisPlateItem.title,
        tags: thisPlateItem.tags,
        connectedAppAttachments: simpleConnectedAppAttachments(thisPlateItem.connectedAppAttachments),
        due: thisPlateItem.due,
        created: thisPlateItem.created,
        modified: thisPlateItem.modified,
        numComments: thisPlateItem.numComments,
        markedDone: thisPlateItem.markedDone,
        previousHeader: thisPlateItem.previousHeader,
        previousPlate: thisPlateItem.previousPlate,
        archived: thisPlateItem.archived,
        metrics: simpleMetrics(thisPlateItem),
        assignees: thisPlateItem.assignees,
        fileAttachments: simpleFileAttachments(thisPlateItem.fileAttachments),
    }
}

function simpleMetrics(plateItem: IPlateItem): ISimpleMetric[] {
    let simpleMetrics: ISimpleMetric[] = [];
    for (let metric of plateItem.metrics) {
        simpleMetrics.push({
            owner: metric.owner,
            ownerType: metric.ownerType,
            value: metric.value,
            name: metric.name
        })
    }
    return simpleMetrics;
}

function simpleConnectedAppAttachments(connectedAppAttachments: IConnectedAppAttachment[]): ISimpleConnectedAppAttachment[] {
    let ret: ISimpleConnectedAppAttachment[] = [];
    for (let attachment of connectedAppAttachments) {
        ret.push({
            id: (<any>attachment).id,
            app: attachment.app,
            created: attachment.created,
            title: attachment.title,
            subtitle: attachment.subtitle,
            content: attachment.content,
            identifier: attachment.identifier,
            connectedAppId: attachment.connectedAppId,
            itemDate: attachment.itemDate,
            customIds: attachment.customIds,
            customDates: attachment.customDates,
            customDetails: attachment.customDetails
        });
    }
    return ret;
}

function simpleFileAttachments(fileAttachments: IFileAttachment[]): ISimpleFileAttachment[] {
    let ret: ISimpleFileAttachment[] = [];
    for (let attachment of fileAttachments) {
        ret.push({
            id: (<any>attachment).id,
            created: attachment.created,
            addedBy: attachment.addedBy,
            item: attachment.item,
            isExternal: attachment.isExternal,
            link: attachment.link,
            connectedApp: attachment.connectedApp,
            connectedAppItemId: attachment.connectedAppItemId,
            fileName: attachment.fileName,
            bytes: attachment.bytes,
            thumbnail: attachment.thumbnail
        });
    }
    return ret;
}

// ------------------------------------------------------------------- Internal Operations

enum PositionUpdateOperation {
    Add,
    Remove,
    MoveUp,
    MoveDown
}

function internalUpdatePositions(operation: PositionUpdateOperation, plateId: string, headerId: string, positionOne: number, excludeItemId?: mongoose.Types.ObjectId, positionTwo?: number): Q.Promise<number> {
    let deferred = Q.defer<number>();

    let pos = null;
    let inc = 0;
    let details: any = {
        'plate': plateId,
        'header': headerId
    }

    switch (operation) {
        case PositionUpdateOperation.Add:
            pos = { $gte: positionOne };
            inc = 1;
            break;
        case PositionUpdateOperation.Remove:
            pos = { $gte: positionOne };
            inc = -1;
            break;
        case PositionUpdateOperation.MoveUp:
            pos = { $gte: positionOne, $lt: positionTwo };
            inc = 1;
            break;
        case PositionUpdateOperation.MoveDown:
            pos = { $gt: positionOne, $lte: positionTwo };
            inc = -1;
            break;
    }

    details.pos = pos;
    if (excludeItemId) {
        // If this is defined, query won't mess with it
        details['_id'] = {
            $ne: excludeItemId
        }
    }

    PlateItem.update(
        details,
        {
            $inc: {
                'pos': inc
            }
        },
        {
            multi: true
        },
        (err, num) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(num);
            }
        }
    );

    return deferred.promise;
}

mongoose.model('PlateItem', PlateItemSchema);
export const PlateItem: IPlateItemStatic = <IPlateItemStatic>mongoose.model('PlateItem');














