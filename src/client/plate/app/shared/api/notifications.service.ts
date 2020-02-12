import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {NewBaseApiService} from "./platebase.service";
import {AuthHttp} from "angular2-jwt";
import {PlateTopBarComponent} from "../topbar/plate-top-bar.component";
import {MomentPipe} from "../../../../shared/scripts/directives/moment.pipe";

export enum ClientNotificationType {
    TeamInvite,
    ItemDueSoon
}

export interface ClientNotification {
    id: string;
    userId: string;
    message: string; // DEPRECATED. Use NotificationType instead
    notificationType: ClientNotificationType;
    live: boolean; // acknowledged is the correct name
    seen: boolean;
    itemId: string;
    link: string; // DEPRECATED. Use itemId instead
    time: Date;
    extra: string;
}

export class UIClientNotification {
    message: string = '';
    extra: string = '';
    constructor(
        public model: ClientNotification
    ) {
        switch (model.notificationType) {
            case ClientNotificationType.ItemDueSoon:
                let dueNum = +model.extra;
                const now = Date.now();
                if (dueNum > now) {
                    this.message = `You have an item due soon: ${model.message}`;
                } else {
                    this.message = `Item due: ${model.message}`;
                }
                this.extra = `Due: ${MomentPipe.staticTransform(dueNum, 'time')}`;
                break;
            case ClientNotificationType.TeamInvite:
            default: // Depracated default
                this.message = model.message;
                break;
        }
    }
}

@Injectable()
export class NotificationsService extends NewBaseApiService<ClientNotification, UIClientNotification> {

    private baseUrl = '/api/notifications';
    private notificationListener: PlateTopBarComponent;

    transformForUI(clientNotification: ClientNotification): UIClientNotification {
        return new UIClientNotification(clientNotification);
    };

    constructor(protected authHttp: AuthHttp){
        super(authHttp);
    }

    setNotificationListener(component: PlateTopBarComponent) {
        this.notificationListener = component;
    }

    onSocketNewNotification(clientNotification: ClientNotification) {
        if (this.notificationListener) {
            this.notificationListener.onNewNotification(clientNotification);
        }
    }

    // ------------------------------------------------------------------- Server
    get(): Observable<UIClientNotification[]> {
        const url = `${this.baseUrl}`;
        return super.getMultiple(url);
    }

    markSeen(notification: UIClientNotification): Observable<string> {
        notification.model.seen = true;
        const url = `${this.baseUrl}/${notification.model.id}/seen`;
        return super.update_({}, url);
    }

    acknowledge(notification: UIClientNotification): Observable<string> {
        notification.model.live = false;
        const url = `${this.baseUrl}/${notification.model.id}/acknowledge`;
        return super.update_({}, url);
    }

}