import {Input, ViewChild, ElementRef} from '@angular/core';
import {UIClientBasePlate} from "../shared/api/baseplate.model";
import {PlateLocalStorageService} from "../shared/utils/platelocalstorage.service";
import {SearchResult} from "../shared/api/search.service";
import { Analytics } from "../../../shared/scripts/analytics.service";

enum ConnectionState {
    Waiting, // Thinking about it - either trying to auth or not - but not first load
    Connected,
    NeedsConnection,
    Initializing // First load if needed
}

export interface BasePlateComponentBase {
    base: UIClientBasePlate;
}

export interface ISearchableBasePlateComponent extends BasePlateComponentBase {
    searchResultClicked(result: SearchResult, callback?);
}

export abstract class BasePlateComponent<T extends UIClientBasePlate> implements BasePlateComponentBase {

    @ViewChild('archiveConfirmDialog')
    archiveConfirmDialog: ElementRef;

    // ViewChild does not work in inherited classes
    @ViewChild('deleteHeaderConfirmDialog')
    deleteHeaderConfirmDialog: ElementRef;

    ConnectionStates = ConnectionState;
    connectionState: ConnectionState = ConnectionState.Waiting;

    @Input('base')
    base: T;

    constructor(args){}

    abstract onClose();
    // abstract onDock();
    // abstract onMinimize();
    // abstract onPin();

    // ------------------------------------------------------------------- UI Events
    closePlateClicked() {
        this.onClose();
        this.base.select(false, true, (<any>this).homePlateService);
        Analytics.default('Plate Close', 'closePlateClicked()');
    }
    plateHeaderClicked($event) {
        if ($event) {
            let $target = $($event.target);
            if(
                !$target.closest('[header-button-wrapper]').length
            ) {
                if (this.base.isMinimized()) {
                    this.base.minimize(false, true, (<any>this).homePlateService);
                }
            }
        }

    }
    pinPlateClicked() {
        // this.onPin();
    }
    dockPlateClicked() {
        this.base.dock(!this.base.isDocked(), true, (<any>this).homePlateService);
        // this.onDock();
        Analytics.default('Plate Dock', 'dockPlateClicked()');
    }
    minimizePlateClicked() {
        this.base.minimize(!this.base.isMinimized(), true, (<any>this).homePlateService);
        // this.onMinimize();
        Analytics.default('Plate Minimize', 'minimizePlateClicked()');
    }
}