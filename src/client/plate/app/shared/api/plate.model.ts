import {ClientBasePlate, UIClientBasePlate} from "./baseplate.model";
import {PlateLocalStorageService} from "../utils/platelocalstorage.service";
import {UIClientPlatter} from "./platter.service";
import {ClientConnectedAppType} from "./connectedapp.model";

export interface IPlateHeader {
    name: string;
    id?: string;
    isDoneHeader?: boolean;
    isHidden?: boolean; // Should be called isMinimized
    isFullyHidden?: boolean; // Completely hide the header - only appropriate for Done
    itemsCanBeDone?: boolean;

    // Client side:
    editing?: boolean;
    editName?: string;
}

export interface ClientPlate extends ClientBasePlate {
    headers: IPlateHeader[];
    platter: string;
    nameIsCustom?: boolean;
    overrideName?: boolean;

    isDynamic?: boolean;
    dynamicQuery?: string;
    searchType?: ClientConnectedAppType;
}

export class UIClientPlate extends UIClientBasePlate {
    model: ClientPlate;
    platter: UIClientPlatter;
    localStorage: PlateLocalStorageService;
    getLocalStorage() { return this.localStorage };
    constructor(model: ClientPlate, localStorageService: PlateLocalStorageService) {
        super();
        this.model = model;
        this.localStorage = localStorageService;
        for (let header of this.model.headers) {
            // Items can be done defaults to true - may not be reflected on server for older plates
            if (header.itemsCanBeDone === undefined || header.itemsCanBeDone === null) {
                header.itemsCanBeDone = true;
            }
        }
    }

    assignPlatter(platter: UIClientPlatter, pos: number) {
        this.platter.plates.remove(this);
        this.platter = platter;
        this.model.platter = platter.model.id;
        this.platter.plates.insert(this, pos);
    }
}






