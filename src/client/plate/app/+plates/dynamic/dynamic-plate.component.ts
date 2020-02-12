import {Component, OnInit} from "@angular/core";
import {PlatesService, BuiltInColors} from "../../shared/api/plates.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {PlateItemsService, UIClientPlateItem} from "../../shared/api/plateitems.service";
import {BasePlateComponent} from "../baseplate.component";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {PlateDragDropService} from "../plate-drag-drop.service";
import {PlateLocalStorageService} from "../../shared/utils/platelocalstorage.service";
import {ConnectedAppItemsService} from "../../shared/api/connectedappitems.service";
import {SocketService} from "../../shared/socket/socket.service";
import {PlateSearchService, SearchServiceCache, SearchResult} from "../../shared/api/search.service";
import {HomePlateService} from "../../+home/homeplate.service";
import {UIClientPlate} from "../../shared/api/plate.model";
import {ClientConnectedAppType} from "../../shared/api/connectedapp.model";
import {ConnectedAppsService} from "../../shared/api/connectedapps.service";
import {BodyDropdownService} from "../../shared/utils/bodyDropdown.directive";
import {PlatterService} from "../../shared/api/platter.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {FilterService} from "../../shared/utils/filter.service";
import {ActivityService} from "../../shared/api/activity.service";
import {EditingPlateItemService} from "../native/item-edit/editing-plate-item.service";

enum PlateMode {
    Default,
    Settings
}

@Component({
    providers: [PlateItemsService, PlateSearchService], // Every Plate component has an instance of PlateItemsService for caching, and dynamic plates have their own search cache
    moduleId: module.id,
    selector: 'dynamic-plate',
    templateUrl: `/ps/app/+plates/dynamic/dynamic-plate.component.html`
})
export class DynamicPlateComponent extends BasePlateComponent<UIClientPlate> implements OnInit {

    constants = {
        defaultSearchResultCount: 10
    }

    private user: LoggedInUser;
    items: {
        [headerId: string]: UIClientPlateItem[]
    } = {};

    searchCache: SearchServiceCache = {};

    PLATEDEBUG = (<any>window).PLATEDEBUG || {};
    PlateMode = PlateMode;
    mode: PlateMode = PlateMode.Default;
    editingPlateName = '';
    editingColor = false;
    colors = BuiltInColors;
    ClientConnectedAppType = ClientConnectedAppType;

    constructor(
        private plateLocalStorageService: PlateLocalStorageService,
        private platesService: PlatesService,
        private plateErrorHandler: PlateErrorHandlerService,
        public plateItemsService: PlateItemsService,
        private plateAuthService: PlateAuthService,
        private plateDragDropService: PlateDragDropService,
        private connectedAppItemsService: ConnectedAppItemsService,
        private editingPlateItemService: EditingPlateItemService,
        private socketService: SocketService,
        private searchService: PlateSearchService,
        private homePlateService: HomePlateService,
        private connectedAppsService: ConnectedAppsService,
        private bodyDropdownService: BodyDropdownService,
        private platterService: PlatterService,
        private filterService: FilterService,
        private activityService: ActivityService
    ) {
        super(arguments);
    }
    ngOnInit() {
        this.searchCache = this.searchService.cache;
        this.sortHeaders();
        this.user = this.plateAuthService.getUserInfo();

        this.doSearch();
    }

    private doSearch() {
        this.searchService.search(this.base.model.dynamicQuery, this.user.id, {maxResults: 10}).subscribe((searchResults) => {
            // Do nothing
        }, err => this.plateErrorHandler.error(err, 'search for dynamic query'));
    }

    onClose() {

    }
    ngOnDestroy() {
        this.onClose();
    }

    // ------------------------------------------------------------------- UI Events
    archivedPlateClicked() {
        this.base.model.archived = true;
        this.platesService.save(<any>this.base.model).subscribe((status) => {
            this.homePlateService.emitPlateArchived(this.base);
            (<any>$(this.archiveConfirmDialog.nativeElement))
                .modal('hide');
        }, err => this.plateErrorHandler.error(err, 'in archive plate'));
        Analytics.default('Archive Plate', 'archivedPlateClicked()');
    }
    onArchivePlateModalHidden() {
        // Nothing
    }
    archivePlateClickedShowDialog() {
        (<any>$(this.archiveConfirmDialog.nativeElement))
            .modal({
                onHide: () => {
                    this.onArchivePlateModalHidden();
                }
            })
            .modal('show');
    }
    nevermindArchivePlateClicked() {
        (<any>$(this.archiveConfirmDialog.nativeElement))
            .modal('hide');
    }

    colorSelected(color: string) {
        this.editingColor = false;
        if (color !== this.base.model.color) {
            this.base.model.color = color;
            this.platesService.save(<any>this.base.model).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in save plate color'));
        }
    }

    editColorClicked() {
        this.editingColor = true;
        Analytics.default('Plate Edit Color', 'editColorClicked()');
    }

    private sortHeaders() {
        this.base.model.headers.sort((a, b) => {
            if (a.isDoneHeader) {
                return 1;
            }
            if (b.isDoneHeader) {
                return -1;
            }
            if (a.name.toLowerCase() === b.name.toLowerCase()) {
                return 0;
            }
            return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
        });
    }

    plateSettingsIconClicked() {
        if (this.mode !== PlateMode.Settings) {
            this.editingPlateName = this.base.model.name;
            this.mode = PlateMode.Settings;
            Analytics.default('Plate Edit Settings', 'plateSettingsIconClicked()');
        } else {
            this.mode = PlateMode.Default;

            Analytics.default('Plate Close Edit Settings', 'Plate Settings');
        }
    }

    leftArrowBackClicked() {
        this.plateSettingsIconClicked();
        Analytics.default('Plate Close Edit Settings', 'leftArrowBackClicked()');
    }

    // From settings
    private plateNameEdited() {
        if (this.base.model.name !== this.editingPlateName) {
            this.base.model.name = this.editingPlateName;
            this.platesService.save(<any>this.base.model).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'In save title from settings'));
        }
    }
    plateNameEditEnterPressed() {
        this.plateNameEdited();
    }
    plateNameEditInputBlur() {
        this.plateNameEdited();
    }

    searchResultClicked($event: any, result: SearchResult) {
        this.searchService.searchResultClicked(result);
        Analytics.default('Search Item Dynamic Plate Clicked', 'searchResultClicked()');
    }

    rerunQueryClicked() {
        this.doSearch();
    }

    // ------------------------------------------------------------------- Drag and drop

    getItemById(id: string) {
        for (let key in this.items) {
            for (let item of this.items[key]) {
                if (item.model.id === id) {
                    return item;
                }
            }
        }
    }


    // ------------------------------------------------------------------- UI State


}