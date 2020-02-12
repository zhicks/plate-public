import {ClientBasePlate, UIClientBasePlate} from "./baseplate.model";
import { Http } from '@angular/http';
import {SearchOptions, SearchResultNoIcon} from "./search.service";
import {PlateLocalStorageService} from "../utils/platelocalstorage.service";
import {UIClientAutomationRule, ClientAutomationRule} from "./connectedapps.service";

export enum ClientConnectedAppType {
    Native,
    Gmail,
    Slack
}

export interface ClientConnectedApp extends ClientBasePlate {
    type: ClientConnectedAppType;
    nameIsCustom: boolean;
    overrideName: boolean;
    automationRules: ClientAutomationRule[];
}

export abstract class UIClientConnectedApp extends UIClientBasePlate {
    model: ClientConnectedApp;
    localStorage: PlateLocalStorageService;
    getLocalStorage() { return this.localStorage };
}