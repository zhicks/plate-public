import {Component, OnInit, ElementRef, ViewChild} from "@angular/core";
import {PlateAuthService, LoggedInUser} from "../../../shared/scripts/auth.service";
import {PlatesService} from "../shared/api/plates.service";
import {PlateErrorHandlerService} from "../shared/utils/plate-error-handler.service";
import {PlateLocalStorageService} from "../shared/utils/platelocalstorage.service";
import {ConnectedAppsService} from "../shared/api/connectedapps.service";
import {UIClientBasePlate} from "../shared/api/baseplate.model";
import {PlateDragDropService, ScrollDirection} from "../+plates/plate-drag-drop.service";
import {ConnectedAppItemsService} from "../shared/api/connectedappitems.service";
import {EditingPlateItemService} from "../+plates/native/item-edit/editing-plate-item.service";
import {ClientUtil} from "../../../shared/scripts/util.service";
import {HomePlateService} from "./homeplate.service";
import {UIClientPlate, ClientPlate} from "../shared/api/plate.model";
import {PlateSideBarService} from "./sidebar/sidebar.component";
import {PlateItemsService} from "../shared/api/plateitems.service";
import {FilterService} from "../shared/utils/filter.service";
import {Analytics} from "../../../shared/scripts/analytics.service";
import {DatePickerService, CalendarChangeEmitObject} from "../shared/utils/semanticCalendar.component";
import {UIClientPlatter} from "../shared/api/platter.service";
import {ClientConnectedAppType} from "../shared/api/connectedapp.model";

const PROVIDERS = [
    ConnectedAppItemsService // Every ConnectedAppPlate will have one of these, but we also need one to generically save
]

@Component({
    providers: PROVIDERS,
    moduleId: module.id,
    selector: 'plate-main-home',
    templateUrl: `/ps/app/+home/home.component.html`
})
export class HomeComponent implements OnInit {

    COMPONENT_ID = 'HomeComponent';

    @ViewChild('dueFilterButton')
    dueFilterButton: ElementRef;
    user: LoggedInUser;

    needsGoogleAuth = false;
    labels: string[] = [];
    localStorageOrder: string[];
    priorityColorClasses: string[] = [];

    addingPlate: UIClientPlate;

    selectedBasePlates: UIClientBasePlate[] = [];

    constructor(
        private plateAuthService: PlateAuthService,
        private plateLocalStorageService: PlateLocalStorageService,
        private platesService: PlatesService,
        private plateErrorHandler: PlateErrorHandlerService,
        private connectedAppsService: ConnectedAppsService,
        private editingPlateItemService: EditingPlateItemService,
        private homePlateService: HomePlateService,
        private plateDragDropService: PlateDragDropService,
        private plateSideBarService: PlateSideBarService,
        private plateItemsService: PlateItemsService,
        private filterService: FilterService,
        private datePickerService: DatePickerService
    ) {}

    ngOnInit() {
        this.user = this.plateAuthService.getUserInfo();
        this.plateSideBarService.registerForSideBarReady(this);
        this.plateSideBarService.inactive = false;
        this.priorityColorClasses = this.plateItemsService.PRIORITY_COLOR_CLASSES;

        this.homePlateService.listenForNewPlateEvent(this);
        this.homePlateService.listenForAddingPlateClosedWithoutId(this);
        this.homePlateService.listenForPlateArchived(this);
        this.homePlateService.listenForConnectedAppArchived(this);
        this.homePlateService.listerForPlateSelectedEvent(this);
        this.homePlateService.listerForPlateDockedEvent(this);
        this.homePlateService.listerForPlateMinimizedEvent(this);
        this.homePlateService.listerForNewDynamicPlate(this);
    }

    ngAfterViewInit() {
        // ViewChild sucks, ngAfterViewInit sucks, just wait one second
        setTimeout(() => {
            this.plateDragDropService.listenForScrollEdges('home-scroll', 'home-scroll', $('[plates-wrapper]'), ScrollDirection.Horizontal);
        }, 1000);
    }

    // ------------------------------------------------------------------- Life cycle

    private refreshSelectedBasePlates() {
        if (this.plateSideBarService._ready) {

            // Temporary. Set the cache then grab a ref
            this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.OPEN_BASE_PLATES);
            this.localStorageOrder = this.plateLocalStorageService.cache[this.plateLocalStorageService.Keys.OPEN_BASE_PLATES];
            let arr = ClientUtil.combineArrays(this.platesService.cache, this.connectedAppsService.cache);
            let order = this.localStorageOrder;
            // Here, delete the key if it does not exist in the array
            this.selectedBasePlates = arr.filter(item => item.selected).sort((a: UIClientPlate, b: UIClientPlate) => {
                return +(order.indexOf(a.model.id) > order.indexOf(b.model.id))
            });
        }
    }
    private refreshDockedMinimizedBasePlates() {
        let openBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.OPEN_BASE_PLATES);
        let dockedBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.DOCKED_BASE_PLATES);
        let minimizedBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.MINIMIZED_BASE_PLATES);
        for (let selectedBasePlate of this.selectedBasePlates) {
            selectedBasePlate.refreshCssRight(this.homePlateService, openBasePlatesInStorage, dockedBasePlatesInStorage, minimizedBasePlatesInStorage);
        }
    }

    // ------------------------------------------------------------------- Events from services

    onNewPlateEvent(platter: UIClientPlatter) {
        let color = this.platesService.constants.DefaultPlateColor;
        let team = platter.team;
        if (team && team.model.color) {
            color = team.model.color;
        }
        this.addingPlate = new UIClientPlate({
            name: '',
            headers: [],
            color: color,
            archived: false,
            platter: platter.model.id,
            listPos: platter.plates.length
        }, this.plateLocalStorageService);
    }

    onNewDynamicPlate(query: string, type: ClientConnectedAppType) {
        if (query && query.length) {
            let dynamicPlateModel: ClientPlate = {
                name: `Search: "${query.substring(0, 20)}"`,
                owner: this.user.id,
                color: '#1B1C1D',
                headers: [],
                platter: null,
                isDynamic: true,
                dynamicQuery: query,
                searchType: type,
                listPos: null
            };
            let newDynamicPlate = new UIClientPlate(dynamicPlateModel, this.plateLocalStorageService);
            newDynamicPlate.transientId = 'TRANSIENT_' + ClientUtil.randomString();
            this.platesService.cache.push(newDynamicPlate);
            newDynamicPlate.select(true, true, this.homePlateService);
        }
    }

    onAddingPlateClosed() {
        this.addingPlate = null;
        this.refreshSelectedBasePlates();
    }

    onPlateArchived(plateToArchive: UIClientBasePlate) {
        plateToArchive.select(false, true, this.homePlateService); // Make sure it's out of localStorage
        let arr = this.platesService.cache;
        for (let i=0; i < arr.length; i++) {
            if (arr[i].model.id === plateToArchive.model.id) {
                arr.splice(i, 1);
                break;
            }
        }
        let plateToArchiveAsUIPlate: UIClientPlate = <UIClientPlate>plateToArchive;
        if (plateToArchiveAsUIPlate.platter) {
            plateToArchiveAsUIPlate.platter.plates.remove(plateToArchiveAsUIPlate);
        }
    }

    onConnectedAppArchived(plateToArchive: UIClientBasePlate) {
        plateToArchive.select(false, true, this.homePlateService); // Make sure it's out of localStorage
        let arr = this.connectedAppsService.cache;
        for (let i=0; i < arr.length; i++) {
            if (arr[i].model.id === plateToArchive.model.id) {
                arr.splice(i, 1);
                break;
            }
        }
    }

    onDueDateChange(dateChangeObject: CalendarChangeEmitObject) {
        if (dateChangeObject && dateChangeObject.date && dateChangeObject.date.getTime) {
            let due = dateChangeObject.date.getTime();
            let option = dateChangeObject.rangeSelection;
            this.filterService.assignDueFilter(due, option);
            Analytics.default('Due Date Filter Selected', 'onDueDateChange()');
        } else {
            this.filterService.removeDueFilter();
        }
    }

    onSideBarReadyEvent(ready: boolean) {
        this.refreshSelectedBasePlates();
        this.refreshDockedMinimizedBasePlates();
    }

    onPlateSelectedEvent(basePlate: UIClientBasePlate, selected: boolean) {
        this.refreshSelectedBasePlates();
        if (basePlate.isDocked()) {
            this.refreshDockedMinimizedBasePlates();
        }
    }

    onPlateDockedEvent(basePlate: UIClientBasePlate, docked: boolean) {
        this.refreshDockedMinimizedBasePlates();
    }
    onPlateMinimizedEvent(basePlate: UIClientBasePlate, minimized: boolean) {
        this.refreshDockedMinimizedBasePlates();
    }

    // ------------------------------------------------------------------- Events from UI

    dueFilterButtonClicked($event) {
        this.datePickerService.listen(this.onDueDateChange.bind(this));
        this.datePickerService.toggle(this.dueFilterButton.nativeElement, this.filterService.currentFilter.due.time, {
            removable: true,
            beforeAfter: true
        });
        Analytics.default('Due Date Filter Click', 'dueFilterButtonClicked()');
    }
    filterPriorityClicked(metricValue: string) {
        this.filterService.assignOrRemoveMetricFilter(this.plateItemsService.priorityString, metricValue);
        Analytics.default('Filter Priority', metricValue);
    }
    filterImpactClicked(metricValue: string) {
        this.filterService.assignOrRemoveMetricFilter(this.plateItemsService.impactString, metricValue);
        Analytics.default('Filter Impact', metricValue);
    }
    filterEffortClicked(metricValue: string) {
        this.filterService.assignOrRemoveMetricFilter(this.plateItemsService.effortString, metricValue);
        Analytics.default('Filter Effort', metricValue);
    }

    // ------------------------------------------------------------------- UI State


}
