import {UIClientConnectedApp, ClientConnectedApp} from "../../api/connectedapp.model";
import {SearchOptions, SearchResultNoIcon} from "../../api/search.service";
import {PlateIntegrationGmailServiceStatic} from "./plate-integration-gmail.service";
import { Http } from '@angular/http';
import {PlateLocalStorageService} from "../../utils/platelocalstorage.service";

export interface ClientGmailConnectedApp extends ClientConnectedApp {
    gmail?: {
    }
}

export class UIClientGmailConnectedApp extends UIClientConnectedApp {
    model: ClientGmailConnectedApp;
    selectedTime: number;

    constructor(model: ClientGmailConnectedApp, selected: boolean, plateLocalStorage: PlateLocalStorageService) {
        super();
        this.model = model;
        this.selected = selected;
        this.localStorage = plateLocalStorage;
    }
}