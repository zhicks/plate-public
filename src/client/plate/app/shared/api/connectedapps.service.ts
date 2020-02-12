import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {PlateBaseService} from "./platebase.service";
import {AuthHttp} from "angular2-jwt";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {UIClientGmailConnectedApp} from "../integrations/gmail/gmail-connected-app.model";
import {UIClientConnectedApp, ClientConnectedAppType, ClientConnectedApp} from "./connectedapp.model";
import {PlateLocalStorageService} from "../utils/platelocalstorage.service";
import {UIClientSlackConnectedApp} from "../integrations/slack/slack-connected-app.model";
import {ConnectedAppSearchResultsWithSize} from "./search.service";
import {UIClientPlate, IPlateHeader} from "./plate.model";

export enum ClientAutomationRuleAction {
    CreatePlateItem
}

export interface ClientAutomationRuleActionObject {
    text: string,
    action: ClientAutomationRuleAction
}

export interface ClientAutomationRule {
    id?: string;
    destPlate: string;
    when: string[];
    contains: string[];
    action: ClientAutomationRuleAction;
    connectedApp: string;
    creator: string;
    destHeader: string;
}

export class UIClientAutomationRule {
    destPlate: UIClientPlate;
    destHeader: IPlateHeader;
    model: ClientAutomationRule;

    static gmailAutomationRuleWhenObjectOptions = [
        'Subject',
        'To',
        'From'
    ]

    static gmailAutomationRuleActionObjectOptions = [
        {
            action: ClientAutomationRuleAction.CreatePlateItem,
            text: 'Create Plate Item'
        }
    ]

    constructor(destPlate: UIClientPlate, model: ClientAutomationRule) {
        this.destPlate = destPlate;
        this.model = model;

        if (this.destPlate) {
            for (let header of destPlate.model.headers) {
                if (header.id === this.model.destHeader) {
                    this.destHeader = header;
                    break;
                }
            }
            if (!this.destHeader) {
                this.destHeader = this.destPlate.model.headers[0];
            }
        }
    }
}

@Injectable()
export class ConnectedAppsService extends PlateBaseService<UIClientConnectedApp> {

    private baseUrl = '/api/users/';
    protected url = null;
    private registrationsForNewToken: {
        [connectedAppId: string]: () => void
    } = {};

    constructor(
        protected authHttp: AuthHttp,
        private plateErrorHandler: PlateErrorHandlerService,
        private plateLocalStorageService: PlateLocalStorageService
    ){
        super(authHttp);
    }

    /**
     * Returns either the identifier for the SVG Logo (like 'plate') that matches up with zIcon,
     * or it returns a URL for a png.
     * @param connectedAppType
     * @param size
     * @param alternate
     * @returns {any}
     */
    getConnectedAppIcon(connectedAppType: ClientConnectedAppType, size?: string, alternate?: string): string {
        switch (connectedAppType) {
            case ClientConnectedAppType.Native:
                return 'plate';
            case ClientConnectedAppType.Gmail:
                if (!size) {
                    return '/ps/assets/integrations/gmail/logo_gmail_32px.png';
                } else {
                    if (size === 'large') {
                        return '/ps/assets/integrations/gmail/logo_gmail_64px.png';
                    }
                }
            case ClientConnectedAppType.Slack:
                if (!size) {
                    if (!alternate) {
                        return '/ps/assets/integrations/slack/logo_slack_32px.png';
                    } else {
                        return '/ps/assets/integrations/slack/logo_slack_32px_white.png';
                    }
                } else {
                    if (size === 'large') {
                        if (!alternate) {
                            return '/ps/assets/integrations/slack/logo_slack_64px.png';
                        } else {
                            return '/ps/assets/integrations/slack/logo_slack_64px_white.png';
                        }
                    }
                }
        }
        return '';
    }

    getAppNameForType(connectedAppType: ClientConnectedAppType) {
        switch (connectedAppType) {
            case ClientConnectedAppType.Native:
                return 'Plate';
            case ClientConnectedAppType.Gmail:
                return 'Gmail';
            case ClientConnectedAppType.Slack:
                return 'Slack';
        }
        return '';
    }

    transformForUI (connectedApp: ClientConnectedApp): UIClientConnectedApp {
        switch (connectedApp.type) {
            case ClientConnectedAppType.Gmail:
                return new UIClientGmailConnectedApp(connectedApp, false, this.plateLocalStorageService);
            case ClientConnectedAppType.Slack:
                return new UIClientSlackConnectedApp(connectedApp, false, this.plateLocalStorageService);
        }
    }

    get (id?: string, refresh?: boolean, userId?: string): Observable<UIClientConnectedApp[] | UIClientConnectedApp> {
        if (userId) {
            this.url = this.baseUrl + userId + '/connectedapps';
        }
        return <Observable<UIClientConnectedApp[] | UIClientConnectedApp>>super.get(id, refresh);
    }

    save (connectedApp: UIClientConnectedApp, userId?: string): Observable<UIClientConnectedApp[] | UIClientConnectedApp> {
        if (userId) {
            this.url = this.baseUrl + userId + '/connectedapps';
        }
        return <Observable<UIClientConnectedApp[] | UIClientConnectedApp>>super.save(<any>connectedApp.model);
    }

    saveAutomationRule(userId: string, connectedApp: UIClientConnectedApp, automationRule: UIClientAutomationRule): Observable<UIClientAutomationRule> {
        const url = `/api/users/${userId}/connectedapps/${connectedApp.model.id}/automation-rules`;
        let destPlate = automationRule.destPlate;
        return this.authHttp.post(url, automationRule.model)
            .map((res) => {
                if (res) {
                    let clientAutomationRule: ClientAutomationRule = res.json();
                    return new UIClientAutomationRule(destPlate, clientAutomationRule);
                }
                return null;
            });
    }

    deleteAutomationRule(userId: string, connectedApp: UIClientConnectedApp, automationRule: UIClientAutomationRule): Observable<string> {
        const url = `/api/users/${userId}/connectedapps/${connectedApp.model.id}/automation-rules/${automationRule.model.id}`;
        let destPlate = automationRule.destPlate;
        return this.authHttp.delete(url)
            .map((res) => {
                if (res) {
                    return res.text();
                }
                return null;
            });
    }

    /**
     * query should be preformatted as ?query=...&maxResults=...
     * @param userId
     * @param connectedApp
     * @param query
     * @returns {Observable<R>}
     */
    search (userId: string, connectedApp: UIClientConnectedApp, query: string): Observable<ConnectedAppSearchResultsWithSize> {
        const url = `/api/users/${userId}/connectedapps/${connectedApp.model.id}/search${query}`;
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.get(url)
            .map((res) => {
                if (res) {
                    return res.json();
                }
                return null;
            });
    }

    getSlackAuthUrl(connectedApp: UIClientConnectedApp, userId: string): string {
        if (userId) {
            this.url = '/auth/users/' + userId + '/connectedapps';
        }
        const url = this.url + '/' + connectedApp.model.id + '/slackauth';
        return url;
    }

    getGmailAuthUrl(connectedApp: UIClientConnectedApp, userId: string): string {
        if (userId) {
            this.url = '/auth/users/' + userId + '/connectedapps';
        }
        const url = this.url + '/' + connectedApp.model.id + '/gmailauth';
        return url;
    }

}