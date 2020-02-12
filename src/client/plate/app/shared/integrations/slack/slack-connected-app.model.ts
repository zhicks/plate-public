import {UIClientConnectedApp, ClientConnectedApp} from "../../api/connectedapp.model";
import {SearchOptions, SearchResultNoIcon} from "../../api/search.service";
import { Http } from '@angular/http';
import {PlateLocalStorageService} from "../../utils/platelocalstorage.service";

export interface ClientSlackConnectedApp extends ClientConnectedApp {
    slack?: {
        defaultChannel?: string;
    }
}

export class UIClientSlackConnectedApp extends UIClientConnectedApp {
    model: ClientSlackConnectedApp;

    constructor(model: ClientSlackConnectedApp, selected: boolean, plateLocalStorage: PlateLocalStorageService) {
        super();
        this.model = model;
        this.selected = selected;
        this.localStorage = plateLocalStorage;
    }
}