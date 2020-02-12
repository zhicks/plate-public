import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {AuthHttp} from "angular2-jwt";
import {NewBaseApiService} from "./platebase.service";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {LoggedInUser} from "../../../../shared/scripts/auth.service";
import {UsersService} from "./users.service";
import {MomentPipe} from "../../../../shared/scripts/directives/moment.pipe";
import {TeamsService} from "./teams.service";
import {PlateComponent} from "../../+plates/native/plate.component";
import {HomePlateService} from "../../+home/homeplate.service";

const MAX_ITEM_LENGTH_FOR_ACTIVITY = 50;

export enum ClientActivityActionType {
    CreatePlateItem,
    EditPlateItemTitle,
    ArchivePlateItem,
    MovePlateItem,
    MarkAsDonePlateItem,
    AttachGmail,
    AttachSlack,
    CreateDueDate,
    ChangeDueDate,
    CreatePlatter,
    ChangePlateItemMetric,
    InviteTeamMember,
    ChangePlateHeader,
    CreateComment,
    EditComment,
    RemoveDueDate,
    NewHeader,
    RemoveHeader,
    UserJoinedTeam,
    RemoveFileAttachment,
    AddFileAttachment,
    PlateMovedPlatters
}

export interface ClientActivity {
    id?: string
    created?: number
    originator: string
    originatorName: string
    team: string
    activityActionType: ClientActivityActionType
    item: string
    plate: string
    platter: string
    acknowledgedBy: string[]
    detail1: string
    detail2: string
    detail3: string
    color: string
}

export class UIClientActivity {
    activityString: string;
    initials: string;
    originatorName: string;
    userAcked: boolean;
    isActivity = true;

    constructor(
        public user: LoggedInUser,
        public model: ClientActivity,
        private usersService: UsersService,
        private teamsService: TeamsService
    ) {
        this.originatorName = model.originatorName;
        if (model.originator === this.user.id) {
            this.originatorName = 'You';
        }
        this.initials = UsersService.getInitials(this.model.originatorName);
        this.activityString = this.createActivityStringAndSetDetail3();
        this.userAcked = model.acknowledgedBy.indexOf(this.user.id) !== -1;
    }

    private shortenItemTitleIfNeeded(detail: string) {
        if (detail && detail.length === MAX_ITEM_LENGTH_FOR_ACTIVITY) {
            detail += '...';
        }
        return detail;
    }
    createActivityStringAndSetDetail3(): string {
        let model = this.model;

        let next = '';
        let detail1 = this.shortenItemTitleIfNeeded(model.detail1);
        switch (model.activityActionType) {
            case ClientActivityActionType.CreatePlateItem:
                next = `created "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.EditPlateItemTitle:
                next = `renamed "${this.shortenItemTitleIfNeeded(model.detail3)}" to "${detail1}" in "${model.detail2}"`;
                this.model.detail3 = null;
                break;
            case ClientActivityActionType.ArchivePlateItem:
                next = `archived "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.MovePlateItem:
                next = `moved "${detail1}" to "${model.detail2}"`;
                break;
            case ClientActivityActionType.MarkAsDonePlateItem:
                next = `marked "${detail1}" as Done in "${model.detail2}"`;
                break;
            case ClientActivityActionType.AttachGmail:
                next = `attached a Gmail to "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.AttachSlack:
                next = `attached a Slack message to "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.CreateDueDate:
                next = `created a due date for "${detail1}" in "${model.detail2}": ${MomentPipe.staticTransform(+model.detail3, 'time')}`;
                this.model.detail3 = null;
                break;
            case ClientActivityActionType.ChangeDueDate:
                next = `changed the due date for "${detail1}" in "${model.detail2}" to ${MomentPipe.staticTransform(+model.detail3, 'time')}`;
                this.model.detail3 = null;
                break;
            case ClientActivityActionType.CreatePlatter:
                next = `created the Platter "${detail1}"`;
                if (model.detail2) {
                    for (let team of this.teamsService.cache) {
                        if (team.model.id === model.detail2) {
                            next += ` for team "${team.model.name}"`;
                            break;
                        }
                    }
                }
                break;
            case ClientActivityActionType.ChangePlateItemMetric:
                next = `changed "${detail1}" for "${model.detail2}"`;
                this.model.detail3 = `${detail1}: ${model.detail3}`;
                break;
            case ClientActivityActionType.InviteTeamMember:
                next = `invited a new team member "${model.detail2}" for "${detail1}"`;
                break;
            case ClientActivityActionType.ChangePlateHeader:
                next = `changed a header in "${model.detail2}"`;
                this.model.detail3 = `New name: ${detail1}`;
                break;
            case ClientActivityActionType.CreateComment:
                next = `added a comment to "${detail1}" in "${model.detail2}"`;
                this.model.detail3 = `"${this.model.detail3}"`;
                break;
            case ClientActivityActionType.EditComment:
                next = `edited a comment in "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.RemoveDueDate:
                next = `removed the due date for "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.NewHeader:
                next = `added the header "${detail1}" to "${model.detail2}"`;
                break;
            case ClientActivityActionType.RemoveHeader:
                next = `removed the header "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.UserJoinedTeam:
                next = `joined the team "${detail1}"`;
                break;
            case ClientActivityActionType.AddFileAttachment:
                next = `attached a file to "${detail1}" in "${model.detail2}"`;
                this.model.detail3 = `"${this.model.detail3}"`;
                break;
            case ClientActivityActionType.RemoveFileAttachment:
                next = `removed the file ${this.model.detail3} from "${detail1}" in "${model.detail2}"`;
                break;
            case ClientActivityActionType.PlateMovedPlatters:
                next = `moved the Plate "${this.model.detail2}" from "${detail1}" to "${model.detail3}"`;
                break;
        }

        return ` ${next}.`;

    }
}

export interface IObjectWithActivity {
    activities?: {
        [activityId: string]: UIClientActivity
    };
    model: {
        id?: string;
    }
}

@Injectable()
export class ActivityService extends NewBaseApiService<ClientActivity, UIClientActivity> {

    private itemUrl = '/api/activites'; // /:id/
    private userBaseUrl = '/api/users';
    private activityClickedForPlateItemListeners: {
        [componentId: string]: PlateComponent
    } = {};

    private user: LoggedInUser;

    private activityMap: {
        [itemId: string]: UIClientActivity[]
    } = {};
    private needsActivityMap: {
        [itemId: string]: IObjectWithActivity
    } = {};

    constants = {

    }

    constructor(
        protected authHttp: AuthHttp,
        private plateErrorHandler: PlateErrorHandlerService,
        private usersService: UsersService,
        private teamsService: TeamsService,
        private homePlateService: HomePlateService
    ){
        super(authHttp);
    }

    setUser(user: LoggedInUser) {
        this.user = user;
    }

    registerForActivityClickedForPlateItem(plateComponent: PlateComponent) {
        this.activityClickedForPlateItemListeners[plateComponent.base.model.id] = (plateComponent);
    }
    unregisterForActivityClickedForPlateItem(plateComponent: PlateComponent) {
        delete this.activityClickedForPlateItemListeners[plateComponent.base.model.id];
    }
    emitActivityClickedForPlateItem(activity: UIClientActivity) {
        for (let key in this.activityClickedForPlateItemListeners) {
            this.activityClickedForPlateItemListeners[key].onActivityClickedForPlateItem(activity);
        }
    }

    transformForUI (clientActivity: ClientActivity): UIClientActivity {
        let uiClientActivity = new UIClientActivity(this.user, clientActivity, this.usersService, this.teamsService);
        if (uiClientActivity.model.item) {
            this.activityMap[uiClientActivity.model.item] = this.activityMap[uiClientActivity.model.item] || [];
            this.activityMap[uiClientActivity.model.item].push(uiClientActivity);
        }
        return uiClientActivity;
    }

    addToCache(activity: ClientActivity) {
        let uiClientActivity = this.transformForUI(activity);
        this.cache.splice(0, 0, uiClientActivity);
        // Attach the activity to its item if present
        if (activity.item && this.needsActivityMap[activity.item]) {
            this.needsActivityMap[activity.item].activities[activity.id] = (uiClientActivity);
            delete this.needsActivityMap[activity.item];
        }
        return uiClientActivity;
    }

    needsActivity(object: IObjectWithActivity) {
        this.needsActivityMap[object.model.id] = object;
    }

    getUnacknowledgedActivities(id: string) {
        let ret = [];
        let activities = this.activityMap[id];
        if (activities) {
            for (let activity of activities) {
                if (!activity.userAcked) {
                    ret.push(activity);
                }
            }
        }
        return ret;
    }

    // ------------------------------------------------------------------- HTTP

    get(userId: string): Observable<UIClientActivity[]> {
        const url = `${this.userBaseUrl}/${userId}/activities`;
        return super.getMultiple(url);
    }

    acknowledge(activity: UIClientActivity): void {
        if (!activity.userAcked) {
            console.log('acking activity');
            activity.model.acknowledgedBy.push(this.user.id);
            activity.userAcked = true;
            this.homePlateService.emitActivityAcknowledged(activity);
            const userId = this.user.id;
            const url = `${this.userBaseUrl}/${userId}/activities/${activity.model.id}/acknowledge`;
            super.update_(null, url).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in save activity status'));
        }
    }

}











