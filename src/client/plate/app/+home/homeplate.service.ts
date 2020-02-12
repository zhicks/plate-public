import { Injectable } from '@angular/core';
import {UIClientBasePlate} from "../shared/api/baseplate.model";
import {PlateSideBarComponent} from "./sidebar/sidebar.component";
import {UIClientActivity} from "../shared/api/activity.service";
import {PlateLocalStorageService} from "../shared/utils/platelocalstorage.service";
import {UIClientPlatter} from "../shared/api/platter.service";
import {ClientConnectedAppType} from "../shared/api/connectedapp.model";

export interface NewPlateListener {
    COMPONENT_ID: string;
    onNewPlateEvent(platter: UIClientPlatter):void;
}
export interface AddingPlateClosedListener {
    onAddingPlateClosed():void;
}
export interface PlateArchivedListener {
    COMPONENT_ID: string;
    onPlateArchived(plateToArchive: UIClientBasePlate):void;
}
export interface ConnectedAppArchivedListener {
    onConnectedAppArchived(plateToArchive: UIClientBasePlate):void;
}
export interface PlateSelectedListener {
    onPlateSelectedEvent(basePlate: UIClientBasePlate, selected: boolean):void;
}
export interface PlateDockedListener {
    onPlateDockedEvent(basePlate: UIClientBasePlate, docked: boolean):void;
}
export interface PlateMinimizeListener {
    onPlateMinimizedEvent(basePlate: UIClientBasePlate, minimized: boolean):void;
}
export interface DynamicPlateListener {
    onNewDynamicPlate(query: string, type: ClientConnectedAppType):void;
}
export interface PowerSearchListener {
    COMPONENT_ID: string;
    onDoPowerSearch(query: string);
}

@Injectable()
export class HomePlateService {

    constants = {
        css: {
            DOCKED_PLATE_WIDTH: 480,
            MINIMIZED_DOCKED_PLATE_WIDTH: 290,
            DOCKED_PLATE_RIGHT: 20,
            DOCKED_PLATE_RIGHT_PAGE_MARGIN: 40
        }
    }

    newPlateEventListeners: NewPlateListener[] = [];
    addingPlateClosedListeners: AddingPlateClosedListener[] = [];
    plateArchivedListeners: PlateArchivedListener[] = [];
    connectedAppArchivedListeners: ConnectedAppArchivedListener[] = [];
    plateOpenByIdListener: PlateSideBarComponent;
    activityAcknowledgedListener: PlateSideBarComponent;
    plateSelectedEventListeners: PlateSelectedListener[] = [];
    plateDockedEventListener: PlateDockedListener;
    plateMinimizedEventListener: PlateMinimizeListener;
    newDynamicPlateListener: DynamicPlateListener;
    powerSearchListeners: PowerSearchListener[] = [];

    constructor(
        private plateLocalStorageService: PlateLocalStorageService
    ) { }

    newPlateWasAdded(plate: UIClientBasePlate) {
        this.emitAddingPlateClosed();
    }

    openPlateById(id: string) {
        this.plateOpenByIdListener && this.plateOpenByIdListener.openPlateById(id);
    }

    // ------------------------------------------------------------------- Listeners
    listenForPowerSearch(listener: PowerSearchListener) {
        this.powerSearchListeners.push(listener);
    }
    emitDoPowerSearch(query: string) {
        for (let listener of this.powerSearchListeners) {
            listener.onDoPowerSearch(query);
        }
    }
    unregisterForPowerSearch(listener: PowerSearchListener) {
        for (let i=0; i < this.powerSearchListeners.length; i++) {
            if (this.powerSearchListeners[i].COMPONENT_ID === listener.COMPONENT_ID) {
                this.powerSearchListeners.splice(i, 1);
                break;
            }
        }
    }

    listerForNewDynamicPlate(listener: DynamicPlateListener) {
        this.newDynamicPlateListener = listener;
    }
    emitNewDynamicPlate(query: string, type: ClientConnectedAppType) {
        this.newDynamicPlateListener && this.newDynamicPlateListener.onNewDynamicPlate(query, type);
    }

    listerForPlateMinimizedEvent(listener: PlateMinimizeListener) {
        this.plateMinimizedEventListener = listener;
    }
    emitPlateMinimizedEvent(basePlate: UIClientBasePlate, minimized: boolean) {
        this.plateMinimizedEventListener && this.plateMinimizedEventListener.onPlateMinimizedEvent(basePlate, minimized);
    }

    listerForPlateDockedEvent(listener: PlateDockedListener) {
        this.plateDockedEventListener = listener;
    }
    emitPlateDockedEvent(basePlate: UIClientBasePlate, docked: boolean) {
        this.plateDockedEventListener && this.plateDockedEventListener.onPlateDockedEvent(basePlate, docked);
    }

    listerForPlateSelectedEvent(listener: PlateSelectedListener) {
        // Only use this if the listener instantiated ONCE!
        this.plateSelectedEventListeners.push(listener);
    }
    emitPlateSelectedEvent(basePlate: UIClientBasePlate, selected: boolean) {
        for (let listener of this.plateSelectedEventListeners) {
            listener.onPlateSelectedEvent(basePlate, selected);
        }
    }

    listerForActivityAcknowledged(activityAcknowledgedListener: PlateSideBarComponent) {
        this.activityAcknowledgedListener = activityAcknowledgedListener;
    }
    emitActivityAcknowledged(activity: UIClientActivity) {
        this.activityAcknowledgedListener && this.activityAcknowledgedListener.onActivityAcknowledged(activity);
    }

    emitJoinedNewTeam() {
        if (this.plateOpenByIdListener) {
            this.plateOpenByIdListener.onJoinNewTeam();
        }
    }

    listenForPlateOpenById(component: PlateSideBarComponent) {
        this.plateOpenByIdListener = (component);
    }

    listenForNewPlateEvent(component: NewPlateListener) {
        this.newPlateEventListeners.push(component);
    }
    emitNewPlateEvent(platter: UIClientPlatter) {
        for (let listener of this.newPlateEventListeners) {
            listener.onNewPlateEvent(platter);
        }
    }
    unregisterForNewPlateEvent(component: NewPlateListener) {
        for (let i = 0; i < this.newPlateEventListeners.length; i++) {
            let registeredListener = this.newPlateEventListeners[i];
            if (component.COMPONENT_ID === registeredListener.COMPONENT_ID) {
                this.newPlateEventListeners.splice(i, 1);
                break;
            }
        }
    }

    listenForAddingPlateClosedWithoutId(component: AddingPlateClosedListener) {
        this.addingPlateClosedListeners.push(component);
    }
    emitAddingPlateClosed() {
        for (let listener of this.addingPlateClosedListeners) {
            listener.onAddingPlateClosed();
        }
    }

    listenForPlateArchived(component: PlateArchivedListener) {
        this.plateArchivedListeners.push(component);
    }
    emitPlateArchived(plateToArchive: UIClientBasePlate) {
        for (let listener of this.plateArchivedListeners) {
            listener.onPlateArchived(plateToArchive);
        }
    }
    unregisterForPlateArchived(component: PlateArchivedListener) {
        for (let i = 0; i < this.plateArchivedListeners.length; i++) {
            let registeredListener = this.plateArchivedListeners[i];
            if (component.COMPONENT_ID === registeredListener.COMPONENT_ID) {
                this.plateArchivedListeners.splice(i, 1);
                break;
            }
        }
    }

    listenForConnectedAppArchived(component: ConnectedAppArchivedListener) {
        this.connectedAppArchivedListeners.push(component);
    }
    emitConnectedAppArchived(plateToArchive: UIClientBasePlate) {
        for (let listener of this.connectedAppArchivedListeners) {
            listener.onConnectedAppArchived(plateToArchive);
        }
    }

    // ------------------------------------------------------------------- Docked Plate Events
    getCssRightForDockedPlate(basePlate: UIClientBasePlate, openBasePlatesInStorage: string[], dockedBasePlatesInStorage: string[], minimizedBasePlatesInStorage: string[]): string {
        let id = basePlate.model.id;
        let isDocked = basePlate.isDocked();
        let isMinimized = basePlate.isMinimized();

        if (!isDocked) {
            return null;
        }

        let indexOfDockedPlate = dockedBasePlatesInStorage.indexOf(id);

        let dockedPlateIdsThatAreSelectedBeforeThisPlate: string[] = [];
        let dockedMinimizedSelectedPlateIds: string[] = [];
        // First only look at the docked plates that are selected
        for (let i=dockedBasePlatesInStorage.length; i > indexOfDockedPlate; i--) {
            let dockedBasePlate = dockedBasePlatesInStorage[i];
            if (openBasePlatesInStorage.indexOf(dockedBasePlate) > -1) {
                dockedPlateIdsThatAreSelectedBeforeThisPlate.push(dockedBasePlate);
            }
        }
        // Then see how many of those are minimized
        for (let minimizedPlate of minimizedBasePlatesInStorage) {
            if (dockedPlateIdsThatAreSelectedBeforeThisPlate.indexOf(minimizedPlate) > -1) {
                dockedMinimizedSelectedPlateIds.push(minimizedPlate);
            }
        }

        let numDockedPlates = dockedPlateIdsThatAreSelectedBeforeThisPlate.length;
        let numDockedMinimizedPlates = dockedMinimizedSelectedPlateIds.length;
        let numDockedNonMinimizedPlates = numDockedPlates - numDockedMinimizedPlates;
        let value = this.constants.css.DOCKED_PLATE_RIGHT_PAGE_MARGIN;
        // Move it to the left by a margin for every plate that's docked, whether minimized or not
        value += this.constants.css.DOCKED_PLATE_RIGHT * numDockedPlates;
        // Move it to the left by the assigned width for all non-minimized
        value += this.constants.css.DOCKED_PLATE_WIDTH * numDockedNonMinimizedPlates;
        // Move it to the left by the assigning minimized width for each minimized
        value += this.constants.css.MINIMIZED_DOCKED_PLATE_WIDTH * numDockedMinimizedPlates;

        return `${value}px`;
    }

}












