import {IPlateHeader} from "./plate.model";
import {PlateLocalStorageService} from "../utils/platelocalstorage.service";
import {HomePlateService} from "../../+home/homeplate.service";
export interface ClientBasePlate {
    name: string;
    listPos: number;
    id?: string;
    owner?: string;
    color?: string;
    created?: number;
    headers?: IPlateHeader[];
    archived?: boolean;
}

export abstract class UIClientBasePlate {
    protected selected: boolean;
    protected docked: boolean;
    protected minimized: boolean;
    protected pinned: boolean;
    protected cssRight: string = null;
    transientId: string;

    // Plates can be minized but not docked
    // We set to docked anyway but don't save in storage
    // simply for display purposes.
    // We must save the plate as docked in local storage
    // for ordering purposes.
    private wasPreviouslyDocked = false;

    model: ClientBasePlate;

    abstract getLocalStorage(): PlateLocalStorageService;

    getSelected() {
        return this.selected;
    }
    isDocked() {
        return this.docked;
    }
    isMinimized() {
        return this.minimized;
    }
    select(selected: boolean, saveInStorage: boolean, homePlateService: HomePlateService) {
        this.selected = selected;
        if (saveInStorage && (this.model.id || this.transientId)) {
            if (selected) {
                this.getLocalStorage().insertInArray(this.getLocalStorage().Keys.OPEN_BASE_PLATES, 0, this.model.id || this.transientId);
            } else {
                this.getLocalStorage().removeInArray(this.getLocalStorage().Keys.OPEN_BASE_PLATES, this.model.id || this.transientId);
            }
        }
        homePlateService.emitPlateSelectedEvent(this, this.selected);
    }
    dock(docked: boolean, saveInStorage: boolean, homePlateService: HomePlateService) {
        this.docked = docked;
        if (saveInStorage && this.model.id) {
            if (docked) {
                this.getLocalStorage().insertInArray(this.getLocalStorage().Keys.DOCKED_BASE_PLATES, 0, this.model.id);
            } else {
                this.getLocalStorage().removeInArray(this.getLocalStorage().Keys.DOCKED_BASE_PLATES, this.model.id);
            }
        }
        homePlateService.emitPlateDockedEvent(this, this.docked);
    }
    minimize(minimized: boolean, saveInStorage: boolean, homePlateService: HomePlateService) {
        this.minimized = minimized;
        let wasPreviouslyDocked = this.wasPreviouslyDocked;
        if (this.model.id) {
            // The plate should have been either docked or not before this minimize call
            if (minimized) {
                if (saveInStorage) {
                    // If this is a user action (i.e. saveInStorage), save it as minimized
                    this.getLocalStorage().insertInArray(this.getLocalStorage().Keys.MINIMIZED_BASE_PLATES, 0, this.model.id);
                    if (this.docked) {
                        // If the plate was docked, we need to remember that
                        this.wasPreviouslyDocked = true;
                    } else {
                        // If the plate was not docked, we need to dock it and remember
                        this.wasPreviouslyDocked = false;
                        this.dock(true, true, homePlateService);
                    }
                } else {
                    // If this was not a user action (i.e. !saveInStorage), we can assume that the plate was in DOCKED_BASE_PLATES
                    // and that docked was already set.
                    this.wasPreviouslyDocked = true;
                }
            } else {
                if (saveInStorage) {
                    // If this is a user action (i.e. saveInStorage), save it
                    this.getLocalStorage().removeInArray(this.getLocalStorage().Keys.MINIMIZED_BASE_PLATES, this.model.id);
                    if (this.wasPreviouslyDocked) {
                        // If it was previously docked, we do nothing since local storage is fine
                    } else {
                        // If the plate was not previously docked, we need remove it from storage
                        this.dock(false, true, homePlateService);
                    }
                } else {
                    // If this was not a user action (i.e. !saveInStorage), we don't have to do anything.
                }
            }
        }
        homePlateService.emitPlateMinimizedEvent(this, this.minimized);
    }
    pin(pinned: boolean, saveInStorage: boolean, homePlateService: HomePlateService) {
        this.pinned = pinned;
        if (saveInStorage && this.model.id) {
            if (pinned) {
                this.getLocalStorage().insertInArray(this.getLocalStorage().Keys.PINNED_BASE_PLATES, 0, this.model.id);
            } else {
                this.getLocalStorage().removeInArray(this.getLocalStorage().Keys.PINNED_BASE_PLATES, this.model.id);
            }
        }
    }

    // ------------------------------------------------------------------- For docked
    refreshCssRight(homePlateService: HomePlateService, openBasePlatesInStorage: string[], dockedBasePlatesInStorage: string[], minimizedBasePlatesInStorage: string[]) {
        if (this.docked) {
            let cssRight = homePlateService.getCssRightForDockedPlate(this, openBasePlatesInStorage, dockedBasePlatesInStorage, minimizedBasePlatesInStorage);
            this.cssRight = cssRight;
        } else {
            this.cssRight = null;
        }
    }

}

