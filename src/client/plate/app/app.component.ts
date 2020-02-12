import {Component, OnInit, ViewChild, ElementRef} from "@angular/core";
import {PlateAuthService} from "../../shared/scripts/auth.service";
import {TeamsService} from "./shared/api/teams.service";
import {PlateErrorHandlerService} from "./shared/utils/plate-error-handler.service";
import {UsersService} from "./shared/api/users.service";
import {PlateToastService} from "../../shared/scripts/directives/plate-toast.component.service";
import {PlatesService} from "./shared/api/plates.service";
import {PlateLocalStorageService} from "./shared/utils/platelocalstorage.service";
import {ConnectedAppsService} from "./shared/api/connectedapps.service";
import {ClientUtil} from "../../shared/scripts/util.service";
import {SocketService} from "./shared/socket/socket.service";
import {PlateSearchService, PlateMasterSearchService} from "./shared/api/search.service";
import {EditingPlateItemService} from "./+plates/native/item-edit/editing-plate-item.service";
import {PlateItemsService} from "./shared/api/plateitems.service";
import {PlateSanitizeService} from "./shared/utils/plate-sanitize.service";
import {DatePickerService} from "./shared/utils/semanticCalendar.component";
import {HomePlateService} from "./+home/homeplate.service";
import {PlateSideBarService} from "./+home/sidebar/sidebar.component";
import {BodyDropdownService} from "./shared/utils/bodyDropdown.directive";
import {PlatterService} from "./shared/api/platter.service";
import {DragulaService} from "ng2-dragula/ng2-dragula";
import {PlateDragDropService} from "./+plates/plate-drag-drop.service";
import {FilterService} from "./shared/utils/filter.service";
import {ActivityService} from "./shared/api/activity.service";
import {PlateRightBarService} from "./+rightbar/plate-right-bar.component";
import {NotificationsService} from "./shared/api/notifications.service";
import {PlatePowerSearchService} from "./shared/powersearch/powersearch.service";

// const PRECOMPILE = [
//     HomeComponent,
//     SettingsMasterComponent,
//     SettingsProfileComponent,
//     SettingsTeamViewComponent,
//     PlateItemEditComponent
// ]

const PROVIDERS = [
    PlateErrorHandlerService,
    ClientUtil,
    PlateSearchService,
    TeamsService,
    UsersService,
    PlateToastService,
    PlatesService,
    PlatterService,
    PlateLocalStorageService,
    ConnectedAppsService,
    SocketService,
    EditingPlateItemService,
    PlateItemsService, // Every Plate component will have one of these, but we also need one to generically save / search etc
    PlateSanitizeService,
    DatePickerService,
    HomePlateService,
    PlateSideBarService,
    BodyDropdownService,
    PlateDragDropService,
    FilterService,
    ActivityService,
    PlateRightBarService,
    DragulaService,
    NotificationsService,
    PlateMasterSearchService,
    PlatePowerSearchService
]

@Component({
    providers: PROVIDERS,
    selector: 'plate-index-app',
    templateUrl: `/ps/app/app.component.html`
})
export class AppComponent implements OnInit {

    @ViewChild('powerSearchWrapper')
    powerSearchWrapper: ElementRef;

    constructor(
        private plateToastService: PlateToastService,
        private plateAuthService: PlateAuthService,
        private plateErrorHandler: PlateErrorHandlerService,
        private connectedAppsService: ConnectedAppsService,
        private socketService: SocketService,
        private datePickerService: DatePickerService,
        private plateSideBarService: PlateSideBarService,
        private plateDragDropService: PlateDragDropService,
        private plateRightBarService: PlateRightBarService,
        private powerSearchService: PlatePowerSearchService,
        private homePlateService: HomePlateService
        ) { }

    ngOnInit() {
        this.plateDragDropService.setPlateDragDropOptions();
        const user = this.plateAuthService.getUserInfo();
        if (!user) {
            this.plateAuthService.redirectToHome();
        }
    }

    ngAfterViewInit() {
        this.powerSearchService.init(this.powerSearchWrapper);
    }

    powerSearchClicked() {
        let query = this.powerSearchService.searchText;
        if (query && query.length > 3 && query.length < 20) {
            this.homePlateService.emitDoPowerSearch(query);
            this.homePlateService.emitNewDynamicPlate(query, null);
        }
    }

}