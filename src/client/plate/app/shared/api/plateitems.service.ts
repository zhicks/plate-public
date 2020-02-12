import {Injectable} from "@angular/core";
import { Observable } from 'rxjs/Observable';
import { AuthHttp } from 'angular2-jwt';
import {PlateBaseService} from "./platebase.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {ClientConnectedAppType} from "./connectedapp.model";
import {UIClientActivity, ActivityService, ClientActivity} from "./activity.service";
import {UIClientTeamMember, TeamsService} from "./teams.service";

export enum AddingItemLocation {
    None,
    Bottom,
    Top
}

export interface ClientConnectedAppAttachment {
    // Immutable:
    app: ClientConnectedAppType,
    created?: number,
    id?: string,

    // Shows up in UI:
    title: string,
    subtitle: string,
    content: string,

    identifier: string,
    connectedAppId: string,
    itemDate: number,

    // Custom:
    customIds: string[],
    customDetails: string[],
    customDates: string[],

    // UI: (This should be a UIClientConnectedAppAttachment)
    expanded?: boolean
}

export interface ClientFileAttachment {
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

    // Not server
    fileExtension?: string
    thumbnailUrlProperty?: string
}

export interface ClientPlateItem {
    title: string;
    owner: string;
    pos: number;
    header: string;
    plate: string;
    archived?: boolean;
    previousHeader?: string;
    previousPlate?: string;
    markedDone?: boolean;
    connectedAppAttachments?: ClientConnectedAppAttachment[];
    id?: string;
    tags?: string[];
    due?: number;
    created?: number;
    modified?: number;
    numComments?: number;
    metrics: ClientMetric[];
    assignees: string[];
    fileAttachments: ClientFileAttachment[];
}

export enum MetricOwnerType {
    User,
    Team
}

export interface ClientMetric {
    name: string,
    owner: string,
    ownerType: MetricOwnerType,
    value: string,
}

export interface UIClientPlateItemConfirmMessage {
    message: string;
}

export interface UIClientPlateItem {
    model: ClientPlateItem;
    assignees: UIClientTeamMember[];
    confirm?: UIClientPlateItemConfirmMessage;
    quickEditing?: boolean;
    isAdding?: AddingItemLocation;
    hoveringOverCheckbox?: boolean;
    hovering?: boolean;

    // For quick access
    priorityValue?: string;
    impactValue?: string;
    effortValue?: string;
    userAckedActivities?: boolean;

    activities?: {
        [activityId: string]: UIClientActivity
    };
}

export interface PlateItemObjectCache {
    [headerId: string]: UIClientPlateItem[]
}

export const DEFAULT_METRIC_NAMES = [
    'Priority',
    'Effort',
    'Impact'
]
export const DEFAULT_METRIC_VALUES = [
    '1',
    '2',
    '3',
    '4',
    '5'
]
export const PRIORITY_COLOR_CLASSES = [
    '',
    'red',
    'orange',
    'yellow',
    'green',
    'blue'
]

@Injectable()
export class PlateItemsService extends PlateBaseService<UIClientPlateItem> {

    protected url = null;
    private baseUrl = '/api/plates/';
    private rawBaseUrl = '/api/plateitems'; // TODO - Structure not good
    DEFAULT_METRIC_NAMES = DEFAULT_METRIC_NAMES;
    DEFAULT_METRIC_VALUES = DEFAULT_METRIC_VALUES;
    PRIORITY_COLOR_CLASSES = PRIORITY_COLOR_CLASSES;
    priorityString = this.DEFAULT_METRIC_NAMES[0];
    effortString = this.DEFAULT_METRIC_NAMES[1];
    impactString = this.DEFAULT_METRIC_NAMES[2];
    objectCache: PlateItemObjectCache = {};

    constructor(
        protected authHttp: AuthHttp,
        protected clientUtil: ClientUtil,
        private activityService: ActivityService,
        private teamsService: TeamsService
    ){
        super(authHttp);
    }

    transformForUI (plateItem: ClientPlateItem): UIClientPlateItem {
        let ret: UIClientPlateItem = {
            model: plateItem,
            assignees: [],
            activities: {}
        }

        if (plateItem.fileAttachments && plateItem.fileAttachments.length) {
            for (let fileAttachment of plateItem.fileAttachments) {
                this.transformFileAttachmentForUi(fileAttachment);
            }
            this.sortFileAttachments(ret);
        }

        // Make sure it has a pos - from previous bug
        if (plateItem.pos === undefined || plateItem.pos === null || plateItem.pos < 0) {
            plateItem.pos = 0;
        }
        // Place metrics on the UI for quick access
        this.updateUiItemMetrics(ret);

        for (let assigneeId of plateItem.assignees) {
            if (this.teamsService.memberPool[assigneeId]) {
                ret.assignees.push(this.teamsService.memberPool[assigneeId]);
            }
        }

        let activities = this.activityService.getUnacknowledgedActivities(plateItem.id);
        for (let activity of activities) {
            ret.activities[activity.model.id] = (activity);
        }
        return ret;
    }

    private transformFileAttachmentForUi(fileAttachment: ClientFileAttachment) {
        let extension = ClientUtil.getExtensionForFileName(fileAttachment.fileName) || 'File';
        fileAttachment.fileExtension = extension;
        if (fileAttachment.thumbnail) {
            fileAttachment.thumbnailUrlProperty = `url('${fileAttachment.thumbnail}')`;
        }
    }
   private sortFileAttachments(plateItem: UIClientPlateItem) {
        plateItem.model.fileAttachments.sort((a, b) => {
            if (a.created > b.created) {
                return -1;
            }
            if (a.created < b.created) {
                return 1;
            }
            return 0;
        })
    }

    addFileAttachmentForUi(uiClientPlateItem: UIClientPlateItem, fileAttachment: ClientFileAttachment) {
        this.transformFileAttachmentForUi(fileAttachment);
        uiClientPlateItem.model.fileAttachments.push(fileAttachment);
        this.sortFileAttachments(uiClientPlateItem);
    }

    getFileAttachmentsSize(uiClientPlateItem: UIClientPlateItem) {
        let fileAttachments = uiClientPlateItem.model.fileAttachments;
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

    addUiItemAssignee(assigneeId: string, uiClientPlateItem: UIClientPlateItem) {
        let member = this.teamsService.memberPool[assigneeId];
        if (member) {
            uiClientPlateItem.assignees.push(member);
        }
    }

    removeUiItemAssignee(assigneeId: string, uiClientPlateItem: UIClientPlateItem) {
        for (let i=0; i < uiClientPlateItem.assignees.length; i++) {
            if (uiClientPlateItem.assignees[i].model.id === assigneeId) {
                uiClientPlateItem.assignees.splice(i, 1);
                break;
            }
        }
    }

    updateUiItemMetrics(uiClientPlateItem: UIClientPlateItem) {
        let priorityString = this.priorityString;
        let effortString = this.effortString;
        let impactString = this.impactString;
        for (let metric of uiClientPlateItem.model.metrics) {
            if (metric.name === priorityString) {
                uiClientPlateItem.priorityValue = metric.value;
            }
            if (metric.name === effortString) {
                uiClientPlateItem.effortValue = metric.value;
            }
            if (metric.name === impactString) {
                uiClientPlateItem.impactValue = metric.value;
            }
        }
    }

    // uploadFileAttachment(uiClientPlateItem: UIClientPlateItem, formData: FormData) {
    //     const url = `${this.rawBaseUrl}/${uiClientPlateItem.model.id}/fileattachments`;
    //     // this.authHttp.post(url, formData, {
    //     //     url?: string;
    //     //     method?: string | RequestMethod;
    //     //     search?: string | URLSearchParams;
    //     //     headers?: Headers;
    //     //     body?: any;
    //     //     withCredentials?: boolean;
    //     //     responseType?: ResponseContentType;
    //     // })
    // }

    getFileAttachmentUploadUrl(uiClientPlateItem: UIClientPlateItem) {
        const url = `${this.rawBaseUrl}/${uiClientPlateItem.model.id}/fileattachments`;
        return url;
    }

    deleteFileAttachment(uiClientPlateItem: UIClientPlateItem, attachment: ClientFileAttachment) {
        for (let i=0; i < uiClientPlateItem.model.fileAttachments.length; i++) {
            let att = uiClientPlateItem.model.fileAttachments[i];
            if (att.id === attachment.id) {
                uiClientPlateItem.model.fileAttachments.splice(i, 1);
                break;
            }
        }
        const url = `${this.rawBaseUrl}/${uiClientPlateItem.model.id}/fileattachments/${attachment.id}`;
        return this.authHttp.delete(url).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    private sortObjectCache() {
        for (let key in this.objectCache) {
            this.objectCache[key].sort(function(a,b) {
                return a.model.pos - b.model.pos;
            });
        }
    }

    // TODO - Make this extend from a diff base
    getCache (id?: string, refresh?: boolean, plateId?: string): Observable<PlateItemObjectCache> {
        if (plateId) {
            this.url = this.baseUrl + plateId + '/items';
        }
        return new Observable<PlateItemObjectCache>((observer) => {
            super.get(id, refresh).subscribe((plateItems) => {
                this.resortItemsIntoHeaders();
                observer.next(this.objectCache);
                observer.complete();
            });
        });
    }

    getById(id: string): Observable<UIClientPlateItem> {
        this.url = this.rawBaseUrl;
        return <Observable<UIClientPlateItem>>super.get(id);
    }

    getActivities(id: string): Observable<UIClientActivity[]> {
        const url = `${this.rawBaseUrl}/${id}/activities`;
        return this.authHttp.get(url).map((res) => {
            if (res) {
                let clientActivities: ClientActivity[] = res.json();
                let uiClientActivities: UIClientActivity[] = [];
                for (let clientActivity of clientActivities) {
                    uiClientActivities.push(this.activityService.transformForUI(clientActivity));
                }
                return uiClientActivities;
            }
            return null;
        });
    }

    save (plateItem: UIClientPlateItem, plateId?: string): Observable<any> {
        if (plateId) {
            this.url = this.baseUrl + plateId + '/items';
        }
        return <Observable<UIClientPlateItem>>super.save(<any>plateItem.model);
    }

    update (plateItem: UIClientPlateItem): Observable<any> {
        this.url = this.rawBaseUrl;
        return <Observable<UIClientPlateItem>>super.save(<any>plateItem.model);
    }

    addAssignee(member: UIClientTeamMember, plateItem: UIClientPlateItem): Observable<string> {
        let foundDuplicateAssignee = false;
        for (let assignee of plateItem.model.assignees) {
            if (assignee === member.model.id) {
                foundDuplicateAssignee = true;
                break;
            }
        }
        if (!foundDuplicateAssignee) {
            plateItem.model.assignees.push(member.model.id);
        }
        this.addUiItemAssignee(member.model.id, plateItem);
        // TODO - Dont send this request if dup assignee
        this.url = this.rawBaseUrl;
        const url = this.url + '/' + plateItem.model.id + '/assignees';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.post(url, {assignee: member.model.id}).map((res) => {
            if (res) {
                return res.json();
            }
            return null;
        });
    }

    removeAssignee(memberId: string, plateItem: UIClientPlateItem): Observable<string> {
        let didRemove = false;
        for (let i = 0; i < plateItem.model.assignees.length; i++) {
            let assigneeId = plateItem.model.assignees[i];
            if (assigneeId === memberId) {
                didRemove = true;
                plateItem.model.assignees.splice(i, 1);
                break;
            }
        }
        this.removeUiItemAssignee(memberId, plateItem);
        // TODO - Dont send this request if did not remove
        this.url = this.rawBaseUrl;
        const url = this.url + '/' + plateItem.model.id + '/assignees/' + memberId;
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.delete(url).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    updateMetric(plateItem: ClientPlateItem, metric: ClientMetric): Observable<string> {
        this.url = this.rawBaseUrl;
        const url = this.url + '/' + plateItem.id + '/metrics';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, <any>metric).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    updateDueDate(plateItem: ClientPlateItem, due: number): Observable<string> {
        this.url = this.rawBaseUrl;
        const url = this.url + '/' + plateItem.id + '/duedate';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, <any>{due: due}).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    deleteAttachment(plateItem: UIClientPlateItem, attachment: ClientConnectedAppAttachment) {
        const url = this.rawBaseUrl + '/' + plateItem.model.id + '/attachments/' + attachment.id;
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.delete(url).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    resortItemsIntoHeaders() {
        for (let key in this.objectCache)
            delete this.objectCache[key];

        for (let plateItem of <UIClientPlateItem[]>this.cache) {
            if (!this.objectCache[plateItem.model.header])
                this.objectCache[plateItem.model.header] = [];

            this.objectCache[plateItem.model.header].push(plateItem);
        }

        this.sortObjectCache();
    }

    /**
     * Updates position for items within same Plate
     * @param fromHeaderId
     * @param item
     * @param newPosition
     */
    updatePosition (saveToServer: boolean, plateId: string, fromHeaderId: string, item: UIClientPlateItem, newPosition: number, targetHeaderId?: string): Observable<any> {
        const sameHeader = targetHeaderId === fromHeaderId || !targetHeaderId;
        if (sameHeader) {
            // Same header, same plate
            let items = this.objectCache[fromHeaderId];
            let oldPosition = item.model.pos;
            ClientUtil.moveInArray(items, oldPosition, newPosition);
            if (newPosition > oldPosition) {
                // It moved down in the list.
                // Start at where it moved from, to where it moved to, and decrease pos by one for each.
                for (let i=oldPosition; i < newPosition; i++) {
                    items[i].model.pos--;
                    if (items[i].model.pos < 0) {
                        items[i].model.pos = 0;
                    }
                }
            } else {
                // It moved up.
                // Start one after where it moved to and increase by one for each.
                for (let i=newPosition+1; i < oldPosition+1; i++) {
                    items[i].model.pos++;
                    if (items[i].model.pos < 0) {
                        items[i].model.pos = 0;
                    }
                }
            }
        } else {
            let itemsFromOriginatingHeader = this.objectCache[fromHeaderId];
            let itemsInNewHeader = this.objectCache[targetHeaderId];
            if (!itemsInNewHeader) {
                itemsInNewHeader = this.objectCache[targetHeaderId] = [];
            }
            let oldPosition = item.model.pos;
            itemsFromOriginatingHeader.splice(oldPosition, 1);
            item.model.header = targetHeaderId;
            itemsInNewHeader.splice(newPosition, 0, item);
            // New item - update pos for each after
            for (let i=newPosition+1; i < itemsInNewHeader.length; i++) {
                itemsInNewHeader[i].model.pos++;
            }
            // And remove item - update pos for each after --
            for (let i=oldPosition; i < itemsFromOriginatingHeader.length; i++) {
                itemsFromOriginatingHeader[i].model.pos--;
            }
        }

        item.model.pos = newPosition;

        if (saveToServer) {
            const url = this.rawBaseUrl + '/' + item.model.id + '/pos';
            let payload: any = { pos: item.model.pos };
            if (!sameHeader) {
                payload.header = targetHeaderId;
            }
            //noinspection TypeScriptUnresolvedFunction
            return this.authHttp.put(url, <any>payload).map((res) => {
                if (res) {
                    // Just a status code for put
                    return res.text();
                }
                return null;
            });
        }

    }

    /**
     * Moves an item from one Plate to another
     * @param item
     * @param targetHeaderId
     * @param newPosition
     */
    moveFromRemote(plateId: string, targetHeaderId: string, fromPlateItems: UIClientPlateItem[], itemId: string, newPosition: number, isDoneHeader: boolean): Observable<any> {
        // TODO - PlateID in every method is not great design

        // First remove the item from the originating Plate's cache,
        // and simultaneously update the positions of everything after it
        let item: UIClientPlateItem = null;
        let indexOfPreviousItem = -1;
        for (let i=0; i < fromPlateItems.length; i++) {
            let fromPlateItem = fromPlateItems[i];
            if (indexOfPreviousItem > -1) {
                // It's been found, so decrease the pos
                fromPlateItem.model.pos--;
            } else if (fromPlateItem.model.id === itemId) {
                indexOfPreviousItem = i;
                item = fromPlateItem;
            }
        }
        fromPlateItems.splice(indexOfPreviousItem, 1);

        // Now add to the new array and update the positions
        let arrayBeingInsertedInto = this.objectCache[targetHeaderId];
        if (!arrayBeingInsertedInto) {
            arrayBeingInsertedInto = this.objectCache[targetHeaderId] = [];
        }
        arrayBeingInsertedInto.splice(newPosition, 0, item);
        for (let i = newPosition + 1; i < arrayBeingInsertedInto.length; i++) {
            arrayBeingInsertedInto[i].model.pos++;
        }

        // Now reflect that in the item model and then to the server
        item.model.header = targetHeaderId;
        item.model.plate = plateId;
        item.model.pos = newPosition;

        const url = this.rawBaseUrl + '/' + item.model.id;
        let payload: any = {
            header: item.model.header,
            plate: item.model.plate,
            pos: item.model.pos,
            markedDone: isDoneHeader
        };
        console.log(payload);
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, <any>payload).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });

    }

    /**
     * Doesnt communicate with server - only inserts into the cache
     * @param plateItem
     */
    insertFromSocketEvent(rawPlateItem: ClientPlateItem): UIClientPlateItem {
        let plateItem = this.transformForUI(rawPlateItem);
        let targetHeaderId = plateItem.model.header;
        const newPosition = plateItem.model.pos;
        let arrayBeingInsertedInto = this.objectCache[targetHeaderId];
        if (!arrayBeingInsertedInto) {
            arrayBeingInsertedInto = this.objectCache[targetHeaderId] = [];
        }
        arrayBeingInsertedInto.splice(newPosition, 0, plateItem);
        for (let i = newPosition + 1; i < arrayBeingInsertedInto.length; i++) {
            arrayBeingInsertedInto[i].model.pos++;
        }
        this.cache.push(plateItem);
        return plateItem;
    }

    /**
     * Doesnt communicate with server - only removes from this cache and updates positions
     * TODO - I am pretty sure this code could be the same as PlateComponent.removeFromUI,
     * as it just uses the item.model.pos to splice it. This method is more complicated
     * since it finds the item by id first, but we could probably use the same code as
     * removeItemFromUI.
     */
    removeFromSocketEvent(oldHeader: string, rawPlateItem: ClientPlateItem) {
        let item: UIClientPlateItem = null;
        let indexOfPreviousItem = -1;
        let plateItems = this.objectCache[oldHeader];
        for (let i=0; i < plateItems.length; i++) {
            let fromPlateItem = plateItems[i];
            if (indexOfPreviousItem > -1) {
                // It's been found, so decrease the pos
                fromPlateItem.model.pos--;
            } else if (fromPlateItem.model.id === rawPlateItem.id) {
                indexOfPreviousItem = i;
                item = fromPlateItem;
            }
        }
        plateItems.splice(indexOfPreviousItem, 1);
    }

}











