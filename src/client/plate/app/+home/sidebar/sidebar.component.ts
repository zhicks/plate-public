import {Component, OnInit, ViewChild, ElementRef, Injectable} from "@angular/core";
import {PlatesService} from "../../shared/api/plates.service";
import {PlateLocalStorageService} from "../../shared/utils/platelocalstorage.service";
import {
    TeamsService,
    UIClientTeam,
    UIClientTeamMember,
    ClientPermissionUserType,
    Permissions,
    ClientPermissionUserTypeStrings,
    ClientTeamMember
} from "../../shared/api/teams.service";
import {ConnectedAppsService} from "../../shared/api/connectedapps.service";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {HomePlateService} from "../homeplate.service";
import {
    UIClientGmailConnectedApp,
    ClientGmailConnectedApp
} from "../../shared/integrations/gmail/gmail-connected-app.model";
import {UIClientConnectedApp, ClientConnectedAppType} from "../../shared/api/connectedapp.model";
import {UIClientPlate, ClientPlate} from "../../shared/api/plate.model";
import {
    ClientSlackConnectedApp,
    UIClientSlackConnectedApp
} from "../../shared/integrations/slack/slack-connected-app.model";
import {Router} from "@angular/router";
import {ClientUtil, ListPositionArrayIdAndPos} from "../../../../shared/scripts/util.service";
import {PlatterService, UIClientPlatter, ClientPlatter} from "../../shared/api/platter.service";
import {PlateDragDropService, ScrollDirection} from "../../+plates/plate-drag-drop.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {ActivityService, ClientActivity, UIClientActivity} from "../../shared/api/activity.service";
import {UsersService} from "../../shared/api/users.service";
import {SocketService} from "../../shared/socket/socket.service";
import {ClientNotification, NotificationsService} from "../../shared/api/notifications.service";
import {UIClientBasePlate} from "../../shared/api/baseplate.model";
import {ClientPlateItem} from "../../shared/api/plateitems.service";

export interface OnSideBarReadyListener {
    COMPONENT_ID: string;
    onSideBarReadyEvent(ready: boolean): void;
}

@Injectable()
export class PlateSideBarService {
    _ready = false;
    inactive = false;

    private onSideBarReadyListeners: OnSideBarReadyListener[] = [];

    registerForSideBarReady(listener: OnSideBarReadyListener) {
        this.onSideBarReadyListeners.push(listener);
        // Call in case already ready
        if (this._ready) {
            listener.onSideBarReadyEvent(this._ready);
        }
    }

    unregisterForSideBarReady(listener: OnSideBarReadyListener) {
        for (let i = 0; i < this.onSideBarReadyListeners.length; i++) {
            let registeredListener = this.onSideBarReadyListeners[i];
            if (listener.COMPONENT_ID === registeredListener.COMPONENT_ID) {
                this.onSideBarReadyListeners.splice(i, 1);
                break;
            }
        }
    }

    setReady(ready: boolean) {
        this._ready = ready;
        for (let listener of this.onSideBarReadyListeners) {
            listener.onSideBarReadyEvent(ready);
        }
    }
}

@Component({
    moduleId: module.id,
    selector: 'plate-side-bar',
    templateUrl: `/ps/app/+home/sidebar/sidebar.component.html`
})
export class PlateSideBarComponent implements OnInit {

    PLATEDEBUG = (<any>window).PLATEDEBUG || {};

    @ViewChild('connectedAppDialog')
    connectedAppDialog: ElementRef

    @ViewChild('platterSettingsDialog')
    platterSettingsDialog: ElementRef;

    @ViewChild('deletePlatterConfirmDialog')
    deletePlatterConfirmDialog: ElementRef;

    @ViewChild('movePlateToNewTeamConfirmDialog')
    movePlateToNewTeamConfirmDialog: ElementRef;

    plates: UIClientPlate[] = [];
    teams: UIClientTeam[] = [];
    plattersByTeam: {
        [teamId: string]: UIClientPlatter[]
    } = {};
    connectedApps: UIClientConnectedApp[];
    ClientConnectedAppType = ClientConnectedAppType;
    user: LoggedInUser;
    movePlateToNewTeamConfirmMessage = '';

    currentTeamMemberFilter = '';
    platterPermissionSets = [];

    platterShowAdvancedPermissions = false;

    // Also the adding platter
    editingPlatter: UIClientPlatter = null;

    ClientPermissionUserTypeStrings = ClientPermissionUserTypeStrings;
    ClientPermissionUserType = ClientPermissionUserType;

    private currentlyConsideringMoving: {
        plate: UIClientPlate
        platter: UIClientPlatter
        pos: number
        previousPos: number,
        didMove: boolean
    } = null;

    connectedAppsExpanded = true;

    private platterIdsWithUnackedActivities: {[platterId: string]: UIClientActivity[]} = {};
    private plateIdsWithUnackedActivities: {[plateId: string]: UIClientActivity[]} = {};

    constructor(
        private platesService: PlatesService,
        private plateLocalStorageService: PlateLocalStorageService,
        private teamsService: TeamsService,
        private connectedAppsService: ConnectedAppsService,
        private plateAuthService: PlateAuthService,
        private plateErrorHandler: PlateErrorHandlerService,
        private homePlateService: HomePlateService,
        private plateSideBarService: PlateSideBarService,
        private router: Router,
        private platterService: PlatterService,
        private plateDragDropService: PlateDragDropService,
        private activityService: ActivityService,
        private socketService: SocketService,
        private notificationsService: NotificationsService,
        private usersService: UsersService
    ) {}

    ngOnInit() {
        this.user = this.plateAuthService.getUserInfo();
        // YC DEMO HACK! ----------------------------------------------------------------------
        if (this.user.email === 'yc@plate.work') {
            if (!this.plateLocalStorageService.getSingleString('yc_demo_user_login')) {
                this.plateLocalStorageService.setArray(this.plateLocalStorageService.Keys.OPEN_BASE_PLATES, ["57f6314636cb2862164ead9c","57f62fe636cb2862164ead99","57f594707ce64a8610352d2f","57f6338636cb2862164eadab"]);
                this.plateLocalStorageService.setArray(this.plateLocalStorageService.Keys.DOCKED_BASE_PLATES, ["57f6314636cb2862164ead9c","57f62fe636cb2862164ead99"]);
                this.plateLocalStorageService.setArray(this.plateLocalStorageService.Keys.MINIMIZED_BASE_PLATES, ["57f6314636cb2862164ead9c"]);
                this.plateLocalStorageService.setSingleString('yc_demo_user_login', 'true');
            }
        }
        // ------------------------------------------------------------------------------------

        this.plateDragDropService.registerSidebar(this);
        this.plateDragDropService.listenForScrollEdges('1', 'list-plate', $('[plate-side-bar]'), ScrollDirection.Vertical);
        this.plates = this.platesService.cache;
        this.teams = this.teamsService.cache;
        this.connectedApps = this.connectedAppsService.cache;
        this.teamsService.setUser(this.user);
        this.activityService.setUser(this.user);
        this.homePlateService.listenForPlateOpenById(this);
        this.homePlateService.listerForActivityAcknowledged(this);

        this.socketService.registerForTeamEvents(this);
        this.socketService.registerForUserEvents(this);
        this.socketService.listenForUserEvents(null);

        // Before getting everything, upgrade if needed
        // We can remove this when everyone has upgraded
        this.platesService.upgradePlattersIfNeeded(this.user.id).subscribe((status) => {
            //console.log('got upgrade result');
            this.refreshPlates();
        }, err => this.plateErrorHandler.error(err, 'in check for platter upgrade'));

        this.activityService.get(this.user.id).subscribe((activities) => {
            for (let activity of activities) {
                this.addActivityToPlateAndPlatterIfNecessary(activity);
            }

        }, err => this.plateErrorHandler.error(err, 'in get activities on load'));
    }

    private addActivityToPlateAndPlatterIfNecessary(activity: UIClientActivity) {
        if (!activity.userAcked) {
            let plate = activity.model.plate;
            let platter = activity.model.platter;
            if (plate && platter) {
                this.platterIdsWithUnackedActivities[platter] = this.platterIdsWithUnackedActivities[platter] || [];
                this.plateIdsWithUnackedActivities[plate] = this.plateIdsWithUnackedActivities[plate] || [];
                this.platterIdsWithUnackedActivities[platter].push(activity);
                this.plateIdsWithUnackedActivities[plate].push(activity);
            }
        }
    }

    onActivityAcknowledged(activity: UIClientActivity) {
        let platter = activity.model.platter;
        let plate = activity.model.plate;
        if (plate && platter) {
            if (this.platterIdsWithUnackedActivities[platter]) {
                for (let i = 0; i < this.platterIdsWithUnackedActivities[platter].length; i++) {
                    let platterActivity = this.platterIdsWithUnackedActivities[platter][i];
                    if (platterActivity.model.id === activity.model.id) {
                        this.platterIdsWithUnackedActivities[platter].splice(i, 1);
                        break;
                    }
                }
            }
            if (this.plateIdsWithUnackedActivities[plate]) {
                for (let i = 0; i < this.plateIdsWithUnackedActivities[plate].length; i++) {
                    let plateActivity = this.plateIdsWithUnackedActivities[plate][i];
                    if (plateActivity.model.id === activity.model.id) {
                        this.plateIdsWithUnackedActivities[plate].splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    platterHasUnackedActivities(platter: UIClientPlatter) {
        return this.platterIdsWithUnackedActivities[platter.model.id] && this.platterIdsWithUnackedActivities[platter.model.id].length;
    }
    plateHasUnackedActivities(plate: UIClientPlate) {
        return this.plateIdsWithUnackedActivities[plate.model.id] && this.plateIdsWithUnackedActivities[plate.model.id].length;
    }

    private refreshTeamRelativePlatters() {
        this.plattersByTeam = {};
        let privateTeam = this.teamsService.userPrivateTeam;
        for (let platter of this.platterService.cache) {
            if (platter.team) {
                this.plattersByTeam[platter.team.model.id] = this.plattersByTeam[platter.team.model.id] || [];
                this.plattersByTeam[platter.team.model.id].push(platter);
            } else {
                this.plattersByTeam[privateTeam.model.id] = this.plattersByTeam[privateTeam.model.id] || [];
                this.plattersByTeam[privateTeam.model.id].push(platter);
            }
        }
    }

    private sortTeams() {
        this.teamsService.cache.sort((a, b) => {
            let aName = a.model.name.toLowerCase();
            let bName = b.model.name.toLowerCase();
            if (aName > bName) {
                return 1;
            } else if (aName < bName) {
                return -1;
            }
            return 0;
        })
    }

    private assignTeamsAndPlatesToUiPlatters() {
        // Assign teams to ui platters
        let platterMap: {[platterId: string]: UIClientPlatter} = {};
        for (let platter of this.platterService.cache) {
            platterMap[platter.model.id] = platter;
            if (platter.model.team) {
                for (let team of this.teamsService.cache) {
                    if (team.model.id === platter.model.team) {
                        platter.team = team;
                        break;
                    }
                }
            }
        }

        // Add plates to platters
        for (let plate of this.platesService.cache) {
            let platter = platterMap[plate.model.platter];
            platter.plates.push(plate);
            plate.platter = platter;
        }

        for (let platter of this.platterService.cache) {
            platter.plates.assignGenericIndexes();
            platter.plates.sortByPosition();
        }

    }
    private setBasePlateInitialStatuses() {
        let plates = this.platesService.cache;
        let connectedApps = this.connectedAppsService.cache;
        let basePlates: UIClientBasePlate[] = ClientUtil.combineArrays(plates, connectedApps);
        let openBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.OPEN_BASE_PLATES);
        let dockedBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.DOCKED_BASE_PLATES);
        let minimizedBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.MINIMIZED_BASE_PLATES);
        let pinnedBasePlatesInStorage: string[] = this.plateLocalStorageService.getArray(this.plateLocalStorageService.Keys.PINNED_BASE_PLATES);
        for (let basePlate of basePlates) {
            let index = openBasePlatesInStorage.indexOf(basePlate.model.id);
            if (index > -1) {
                basePlate.select(true, false, this.homePlateService);
            }
            index = dockedBasePlatesInStorage.indexOf(basePlate.model.id);
            if (index > -1) {
                basePlate.dock(true, false, this.homePlateService);
            }
            index = minimizedBasePlatesInStorage.indexOf(basePlate.model.id);
            if (index > -1) {
                basePlate.minimize(true, false, this.homePlateService);
            }
            index = pinnedBasePlatesInStorage.indexOf(basePlate.model.id);
            if (index > -1) {
                basePlate.pin(true, false, this.homePlateService);
            }
        }
    }

    private doneLoading() {
        if (this.platesService.cache.length === 1 && !this.connectedAppsService.cache.length) {
            // This is either first load, or there is just one plate. Either way, select the Plate.
            let plate = this.platesService.cache[0];
            if (!plate.getSelected()) {
                plate.select(true, true, this.homePlateService);
            }
        }
        this.setBasePlateInitialStatuses();
        this.assignTeamsAndPlatesToUiPlatters();
        this.refreshTeamRelativePlatters();
        this.sortTeams();
        this.plateSideBarService.setReady(true);
    }
    private refreshPlates() {
        console.log('refresh plates');
        ClientUtil.clearArray(this.platesService.cache);
        ClientUtil.clearArray(this.connectedAppsService.cache);

        let gotConnectedApps = false;
        let gotPlates = false;
        let gotPlatters = false;
        let gotTeams = false;

        function gotEverything() {
            return gotTeams && gotConnectedApps && gotPlatters && gotPlates;
        }

        this.teamsService.get().subscribe((teams) => {
            gotTeams = true;
            if (gotEverything()) {
                this.doneLoading();
            }
        }, error => this.plateErrorHandler.error(error, 'team service get'));

        this.platesService.get(null, null, this.user.id).subscribe((plates: UIClientPlate[]) => {
            gotPlates = true;
            if (gotEverything()) {
                this.doneLoading();
            }
        }, error => this.plateErrorHandler.error(error, 'Get plates'));

        this.connectedAppsService.get(null, null, this.user.id).subscribe((connectedApps) => {
            gotConnectedApps = true;
            if (gotEverything()) {
                this.doneLoading();
            }
        }, error => this.plateErrorHandler.error(error, 'Get connected apps'));

        this.platterService.get(this.user.id).subscribe((platters) => {
            console.log(platters);
            gotPlatters = true;
            if (gotEverything()) {
                this.doneLoading();
            }
        }, error => this.plateErrorHandler.error(error, 'Get platters'));

    }

    onJoinNewTeam() {
        this.refreshPlates();
    }

    // --------------------------------------------------------- Events from UI
    private goToHomeIfInactive() {
        if (this.plateSideBarService.inactive) {
            this.router.navigate(['/']);
        }
    }

    teamHeadingClicked($event, team: UIClientTeam) {
        if ($event) {
            team.expanded = !team.expanded;
        }
    }

    changePermissionUserTypeClicked(permission: any, userType: ClientPermissionUserType) {
        // Updated on save
        // Since this is a platter, indicate that it's a user override
        permission.isOverride = true;
        permission.userType = userType;
    }

    editingInviteOnlyPlatterMemberClicked(member: UIClientTeamMember) {
        if (this.editingPlatter.editTeam.canModifyPlatter(this.user)) {
            if (member.model.id !== this.editingPlatter.model.owner) {
                member.selected = !member.selected;
            }
        }
    }

    teamVisiblePlatterSettingClicked() {
        this.editingPlatter.editIsInviteOnly = false;
    }
    inviteOnlyPlatterSettingClicked() {
        this.editingPlatter.editIsInviteOnly = true;
    }

    connectedAppsHeadingClicked($event) {
        this.connectedAppsExpanded = !this.connectedAppsExpanded;
    }

    platterSettingsClicked(platter: UIClientPlatter) {
        this.editingPlatter = platter;
        this.editingPlatter.editName = platter.model.name;
        this.editingPlatter.editTeam = platter.team;
        this.showPlatterDialog();

        Analytics.default('Platter Edit Settings', 'platterSettingsClicked()')
    }

    newPlatterClicked(team: UIClientTeam) {
        this.goToHomeIfInactive();
        const teamId = team.isUser ? null : team.model.id;
        this.editingPlatter = new UIClientPlatter({
            name: '',
            owner: this.user.id,
            team: teamId,
            expanded: true
        });
        this.editingPlatter.editTeam = team.isUser ? null : team;

        this.showPlatterDialog();

        Analytics.default('Platter Add', 'newPlatterClicked()');
    }

    expandPlatterClicked(platter: UIClientPlatter) {
        this.goToHomeIfInactive();
        platter.model.expanded = !platter.model.expanded;
        this.platterService.setExpanded(platter).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, 'in set platter expanded'));
    }

    platterNameClicked(platter: UIClientPlatter) {
        this.goToHomeIfInactive();
        for (let plate of this.platesService.cache) {
            plate.select(false, true, this.homePlateService);
        }
        for (let plate of platter.plates) {
            plate.select(true, true, this.homePlateService);
        }
        Analytics.default('Platter Name Clicked', 'platterNameClicked()');
    }

    addPlateClicked(platter: UIClientPlatter) {
        this.goToHomeIfInactive();
        this.homePlateService.emitNewPlateEvent(platter);

        Analytics.default('Plate Add', 'addPlateClicked()')
    }

    addConnectedAppClicked() {
        this.goToHomeIfInactive();
        this.showConnectedAppDialog();
        Analytics.default('Add Connected App Dialog Clicked', 'addConnectedAppClicked()')
    }

    plateClicked(plate: UIClientPlate) {
        this.goToHomeIfInactive();
        plate.select(!plate.getSelected(), true, this.homePlateService);
        Analytics.default('Plate Clicked', 'plateClicked()')
    }

    openPlateById(id: string) {
        for (let plate of this.platesService.cache) {
            if (plate.model.id === id) {
                this.goToHomeIfInactive();
                if (!plate.getSelected()) {
                    plate.select(true, true, this.homePlateService);
                }
            }
        }
    }

    connectedAppClicked(connectedApp: UIClientConnectedApp) {
        this.goToHomeIfInactive();
        connectedApp.select(!connectedApp.getSelected(), true, this.homePlateService);
        Analytics.default('Connected App Clicked', 'connectedAppClicked()')
    }

    removeTeamForEditingPlatterAsNonOwner() {
        this.editingPlatter.model.team = null;
        this.platterService.update(this.editingPlatter).subscribe((status) => {
            for (let i=0; i < this.platterService.cache.length; i++) {
                let platter = this.platterService.cache[i];
                if (platter.model.id === this.editingPlatter.model.id) {
                    this.platterService.cache.splice(i, 1);
                    break;
                }
            }
            this.removePlatesFromCacheForEditingPlatter();
            this.hidePlatterDialog();
        }, err => this.plateErrorHandler.error(err, 'in save existing platter remove from team'));
    }

    deletePlatterClicked() {
        (<any>$(this.deletePlatterConfirmDialog.nativeElement))
            .modal({
                onHide: () => {
                    this.onDeletePlatterConfirmDialogModalHidden();
                }
            })
            .modal('show');
        
        Analytics.default('Platter Edit Settings', 'Delete Platter Button');
    }

    // ------------------------------------------------------------------- Drag and drop
    plateDropped(plateId: string, platterId: string, pos: number, previousPos: number) {
        let droppedPlate: UIClientPlate;
        let platterDroppedOnto: UIClientPlatter;
        for (let plate of this.platesService.cache) {
            if (plate.model.id === plateId) {
                droppedPlate = plate;
                break;
            }
        }
        for (let platter of this.platterService.cache) {
            if (platter.model.id === platterId) {
                platterDroppedOnto = platter;
                break;
            }
        }
        if (platterDroppedOnto.model.id === droppedPlate.model.platter) {
            // Same platter
            platterDroppedOnto.plates.updatePositionForItem(droppedPlate, pos);
            this.platterService.movePlateSamePlatter(platterDroppedOnto).subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'movePlateSamePlatter'));
        } else {
            // Diff platter
            if (platterDroppedOnto.model.team === droppedPlate.platter.model.team) {
                // Same team
                let oldPlatter = droppedPlate.platter;
                droppedPlate.assignPlatter(platterDroppedOnto, pos);
                this.platesService.movePlateToNewPlatter(droppedPlate, oldPlatter).subscribe((status) => {
                	// Do nothing
                }, err => this.plateErrorHandler.error(err, 'movePlateToNewPlatter'));
            } else {
                // Diff team
                this.movePlateToNewTeamConfirmMessage = `Moving "${droppedPlate.model.name}" to "${platterDroppedOnto.model.name}" will change its team.`;
                this.currentlyConsideringMoving = {
                    plate: droppedPlate,
                    platter: platterDroppedOnto,
                    pos: pos,
                    previousPos: previousPos,
                    didMove: false
                };
                this.showMovePlateToNewTeamConfirmDialog();
            }
        }
    }

    private onHideMovePlateToNewTeamConfirmDialog() {
        if (!this.currentlyConsideringMoving.didMove) {
            this.plateDragDropService.undoMove();
        }
        this.currentlyConsideringMoving = null;
    }
    private showMovePlateToNewTeamConfirmDialog() {
        (<any>$(this.movePlateToNewTeamConfirmDialog.nativeElement))
            .modal({
                duration: 0,
                onHide: () => {
                    this.onHideMovePlateToNewTeamConfirmDialog();
                }
            })
            .modal('show');
    }
    private hideMovePlateToNewTeamConfirmDialog() {
        (<any>$(this.movePlateToNewTeamConfirmDialog.nativeElement))
            .modal('hide');
    }
    movePlateToNewTeamConfirmClicked() {
        let plate = this.currentlyConsideringMoving.plate;
        let platter = this.currentlyConsideringMoving.platter;
        let pos = this.currentlyConsideringMoving.pos;
        let oldPlatter = plate.platter;
        plate.assignPlatter(platter, pos);
        this.currentlyConsideringMoving.didMove = true;
        this.hideMovePlateToNewTeamConfirmDialog();
        this.platesService.movePlateToNewPlatter(plate, oldPlatter).subscribe((status) => {
            // Do nothing
        }, err => this.plateErrorHandler.error(err, 'movePlateToNewPlatter'));
    }
    nevermindMovePlateToNewTeamConfirmClicked() {
        this.hideMovePlateToNewTeamConfirmDialog();
    }

    // ------------------------------------------------------------------- Connected App Dialog
    // Connected App Item Add
    private addGmail() {
        const user = this.plateAuthService.getUserInfo();
        let model: ClientGmailConnectedApp = {
            name: 'Gmail',
            type: ClientConnectedAppType.Gmail,
            owner: user.id,
            nameIsCustom: false,
            overrideName: false,
            automationRules: [],
            listPos: null
        }
        let gmailApp = new UIClientGmailConnectedApp(model, false, this.plateLocalStorageService);
        this.connectedAppsService.save(gmailApp, user.id).subscribe((connectedApp: UIClientConnectedApp) => {
            this.connectedAppsService.cache.push(connectedApp);
            connectedApp.dock(true, true, this.homePlateService);
            connectedApp.select(true, true, this.homePlateService);
        }, error => this.plateErrorHandler.error(error, 'In add gmail clicked'));
    }
    addGmailClicked() {
        this.goToHomeIfInactive();
        this.addGmail();
        Analytics.default('Add Gmail Clicked', 'addGmailClicked');
    }

    private addSlack() {
        const user = this.plateAuthService.getUserInfo();
        let model: ClientSlackConnectedApp = {
            name: 'Slack',
            type: ClientConnectedAppType.Slack,
            owner: user.id,
            nameIsCustom: false,
            overrideName: false,
            automationRules: [],
            listPos: null
        }
        let slackApp = new UIClientSlackConnectedApp(model, false, this.plateLocalStorageService);
        this.connectedAppsService.save(slackApp, user.id).subscribe((connectedApp: UIClientConnectedApp) => {
            this.connectedAppsService.cache.push(connectedApp);
            connectedApp.dock(true, true, this.homePlateService);
            connectedApp.select(true, true, this.homePlateService);
        }, error => this.plateErrorHandler.error(error, 'In add slack clicked'));
    }
    addSlackClicked() {
        this.goToHomeIfInactive();
        this.addSlack();
        Analytics.default('Add Slack Clicked', 'addSlackClicked');
    }

    // Dialog
    addGmailInDialogClicked() {
        this.goToHomeIfInactive();
        this.hideConnectedAppDialog();
        this.addGmail();
        Analytics.default('Add Gmail in Dialog Clicked', 'addGmailInDialogClicked');
    }
    addSlackInDialogClicked() {
        this.goToHomeIfInactive();
        this.hideConnectedAppDialog();
        this.addSlack();
        Analytics.default('Add Slack in Dialog Clicked', 'addSlackInDialogClicked');
    }
    onConnectedAppModalHidden() {
        // Nothing
    }
    nevermindConnectedAppDialogClicked() {
        this.goToHomeIfInactive();
        this.hideConnectedAppDialog();
    }
    private hideConnectedAppDialog() {
        this.goToHomeIfInactive();
        (<any>$(this.connectedAppDialog.nativeElement))
            .modal('hide');
    }
    private showConnectedAppDialog() {
        this.goToHomeIfInactive();
        (<any>$(this.connectedAppDialog.nativeElement))
            .modal({
                duration: 0,
                onHide: () => {
                    this.onConnectedAppModalHidden();
                }
            })
            .modal('show');
    }

    // ------------------------------------------------------------------- Platter dialog
    private savePlatterDialog() {

        if (this.editingPlatter.editName.length < 1) {
            return;
        }

        let somethingChanged = false;
        if (this.editingPlatter.editName !== this.editingPlatter.model.name) {
            this.editingPlatter.model.name = this.editingPlatter.editName;
            somethingChanged = true;
        }

        let platterTeam = this.editingPlatter.editTeam;
        this.editingPlatter.model.team = platterTeam && platterTeam.model.id;

        if (platterTeam && platterTeam.isPlateBusiness) {
            // If it's business just set somethingChanged to true for now
            somethingChanged = true;

            // Invite only and members for now
            let inviteOnly = this.editingPlatter.editIsInviteOnly;
            this.editingPlatter.model.plateBusiness.inviteOnly = inviteOnly;
            if (inviteOnly) {
                this.editingPlatter.model.plateBusiness.members = [];
                for (let member of platterTeam.sortedMembers) {
                    if (member.selected) {
                        this.editingPlatter.model.plateBusiness.members.push(member.model.id);
                    }
                }
            }

            // The permissions
            for (let permissionSet of this.platterPermissionSets) {
                for (let permission of permissionSet.permissions) {
                    if (permission.isOverride) {
                        this.editingPlatter.model.plateBusiness.permissions[permission.key] = permission.userType;
                    }
                }
            }

        }

        if (somethingChanged) {
            if (this.editingPlatter.model.id) {
                // This is a change to existing
                this.platterService.update(this.editingPlatter).subscribe((status) => {
                    // Do nothing
                    this.editingPlatter = null;
                    this.refreshTeamRelativePlatters();
                }, err => this.plateErrorHandler.error(err, 'in save existing platter'));
            } else {
                // This is new
                this.platterService.create(this.editingPlatter, this.user.id).subscribe((newPlatter) => {
                    newPlatter.team = this.editingPlatter.editTeam;
                    this.editingPlatter = null;
                    this.refreshTeamRelativePlatters();
                }, err => this.plateErrorHandler.error(err, 'in save new platter'));
            }

            Analytics.default('Platter Edit Settings', 'Save Platter Button somethingChanged == true');
        } else {
            this.editingPlatter = null;

            Analytics.default('Platter Edit Settings', 'Save Platter Button somethingChanged == false');
        }
        this.hidePlatterDialog();
    }
    savePlatterDialogClicked() {
        this.savePlatterDialog();
    }
    editNamePlatterDialogEnterPressed($event) {
        if ($event && $event.preventDefault) {
            $event.preventDefault();
        }
        this.savePlatterDialog();
    }
    onPlatterModalHidden() {

    }
    nevermindPlatterDialogClicked() {
        this.goToHomeIfInactive();
        this.hidePlatterDialog();

        Analytics.default('Platter Edit Settings', 'Nevermind Button');
    }
    private hidePlatterDialog() {
        (<any>$(this.platterSettingsDialog.nativeElement))
            .modal('hide');
    }
    private showPlatterDialog() {
        // Init editing platter with relevant info
        if (this.editingPlatter.editTeam && this.editingPlatter.editTeam.isPlateBusiness) {
            this.platterShowAdvancedPermissions = false;
            this.editingPlatter.editIsInviteOnly = this.editingPlatter.model.plateBusiness.inviteOnly;
            let platterMemberMap = {};
            let platterMembers = this.editingPlatter.model.plateBusiness.members;
            if (platterMembers && platterMembers.length) {
                for (let platterMember of platterMembers) {
                    platterMemberMap[platterMember] = platterMember;
                }
            } else {
                let platterMember = this.editingPlatter.model.owner;
                platterMembers.push(platterMember);
                platterMemberMap[platterMember] = platterMember;
            }
            for (let member of this.editingPlatter.editTeam.sortedMembers) {
                member.selected = false;
                if (platterMemberMap[member.model.id]) {
                    member.selected = true;
                }
            }
            this.platterPermissionSets = Permissions.getPlatterPermissionSet(this.editingPlatter, this.editingPlatter.editTeam);
        }

        this.goToHomeIfInactive();
        (<any>$(this.platterSettingsDialog.nativeElement))
            .modal({
                duration: 0,
                onHide: () => {
                    this.onPlatterModalHidden();
                },
                observeChanges: true
            })
            .modal('show');
    }

    // ------------------------------------------------------------------- Delete Platter dialog
    private onDeletePlatterConfirmDialogModalHidden() {
        // Nothing
    }
    private hideDeletePlatterConfirmDialog() {
        (<any>$(this.deletePlatterConfirmDialog.nativeElement))
            .modal('hide');
    }

    private removePlatesFromCacheForEditingPlatter() {
        this.platesService.removeFromCacheForPlatterRemoval(this.editingPlatter.model.id);
        this.editingPlatter = null;
        this.refreshTeamRelativePlatters();
    }

    deletePlatterConfirmClicked() {
        this.platterService.delete(this.editingPlatter.model).subscribe((status) => {
            this.removePlatesFromCacheForEditingPlatter();
        }, err => this.plateErrorHandler.error(err, 'in delete platter'));
        this.hideDeletePlatterConfirmDialog();

        Analytics.default('Platter delete', 'deletePlatterConfirmClicked()');
    }

    nevermindDeletePlatterConfirmClicked() {
        this.hideDeletePlatterConfirmDialog();
    }

    // --------------------------------------------------------- UI State

    teamMemberIsFilteredOut(member: UIClientTeamMember) {
        // TODO - Needs debounce and optimization
        if (!this.currentTeamMemberFilter) {
            return false;
        }

        return member.model.name && member.model.name.toLowerCase().indexOf(this.currentTeamMemberFilter.toLowerCase()) === -1;
    }

    getMembersForEditingPlatter() {
        if (this.editingPlatter && this.editingPlatter.editIsInviteOnly) {
            return this.editingPlatter.editTeam.sortedMembers.filter((a) => {
                return a.selected;
            })
        }
    }

    getPotentialMembersForEditingPlatter() {
        return this.editingPlatter.editTeam.sortedMembers.filter((a) => {
            return !a.selected && a.model.id !== this.editingPlatter.model.owner;
        })
    }

    plateIsSelected(plate: UIClientPlate) {
        return plate.getSelected();
    }

    getTeamsAndPersonal() {
        let teamArrayCopy: UIClientTeam[] = ClientUtil.combineArrays([], this.teamsService.cache);
        teamArrayCopy.push(this.teamsService.userPrivateTeam);
        return teamArrayCopy;
    }

    userIsAdminOfPlatterTeam() {
        let platter = this.editingPlatter;
        let teamId = platter && platter.model.team;
        if (teamId) {
            let teamFromUser = this.plateAuthService.getUserInfo().teams.map((userTeam) => {
                return userTeam.id === teamId ? userTeam : null;
            })[0];
            if (teamFromUser) {
                return teamFromUser.role === 'admin';
            } else {
                return false;
            }
        }
    }

    // ------------------------------------------------------------------- Socket events

    onTeamPlateAdded(msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) {
        if (msg.from.id !== this.user.id) {
            let uiClientPlate = this.platesService.getFromCache(msg.plate.id);
            if (uiClientPlate) {
                let uiClientPlatter = this.platterService.getFromCache(msg.plate.platter);
                if (uiClientPlatter) {
                    uiClientPlate.assignPlatter(uiClientPlatter, msg.plate.listPos);
                }
            } else {
                this.platesService.addToCache(this.platesService.transformForUI(msg.plate), this.platterService);
            }
        }
    }
    onTeamPlateArchived(msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) {
        if (msg.from.id !== this.user.id) {
            let uiClientPlate = null;
            for (let cachePlate of this.platesService.cache) {
                if (cachePlate.model.id === msg.plate.id) {
                    uiClientPlate = cachePlate;
                    break;
                }
            }
            if (uiClientPlate) {
                this.homePlateService.emitPlateArchived(uiClientPlate);
            }
        }
    }
    onTeamPlateEdited(msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) {
        if (msg.from.id !== this.user.id) {
            this.platesService.updateFromSocket(msg.plate, this.platterService);
        }
    }

    // This will only be called if a new platter is added to a current team - no moving of platters
    onTeamPlatterAdded(msg:{ from: ClientTeamMember, teamId: string, platter: ClientPlatter }) {
        if (msg.from.id !== this.user.id) {
            let uiClientPlatter = this.platterService.transformForUI(msg.platter);
            if (uiClientPlatter.model.team) {
                for (let team of this.teamsService.cache) {
                    if (team.model.id === uiClientPlatter.model.team) {
                        uiClientPlatter.team = team;
                        break;
                    }
                }
            }
            this.platterService.addToCache(uiClientPlatter);
            this.refreshTeamRelativePlatters();
        }
    }

    // // We would only get this if we have access to the team.
    // onTeamPlatterMoveToTeam(msg:{ from: User, platter: ClientPlatter, oldTeam: string }) {
    //     if (msg.from.id !== this.user.id) {
    //
    //         // First check to see if we have this Platter already. (It may have been moved
    //         // from one team to another that we have access to as well.)
    //         // If not, we'll need to get the Plates.
    //         let foundPlatter: UIClientPlatter = null;
    //         for (let cachePlatter of this.platterService.cache) {
    //             if (cachePlatter.model.id === msg.platter.id) {
    //                 foundPlatter = cachePlatter;
    //                 break;
    //             }
    //         }
    //         if (foundPlatter) {
    //             foundPlatter.model.team = msg.platter.team;
    //             for (let team of this.teamsService.cache) {
    //                 if (team.id === foundPlatter.model.team) {
    //                     foundPlatter.team = team;
    //                     break;
    //                 }
    //             }
    //         } else {
    //             // We didn't have the Platter present in another team - get plates for it.
    //             this.platesService.getForPlatterId(this.user.id, msg.platter.id).subscribe((plates: UIClientPlate[]) => {
    //                 let uiClientPlatter = this.platterService.transformForUI(msg.platter);
    //                 let uiClientPlates: UIClientPlate[] = [];
    //                 if (uiClientPlatter.model.team) {
    //                     let foundNewTeam: Team = null;
    //                     for (let team of this.teamsService.cache) {
    //                         if (team.id === uiClientPlatter.model.team) {
    //                             foundNewTeam = team;
    //                             break;
    //                         }
    //                     }
    //                     if (foundNewTeam) {
    //                         uiClientPlatter.team = foundNewTeam;
    //                     }
    //                 }
    //                 this.platterService.addToCache(uiClientPlatter);
    //                 for (let plate of plates) {
    //                     this.platesService.addToCache(plate, this.platterService);
    //                 }
    //             }, err => this.plateErrorHandler.error(err, 'plates'));
    //         }
    //     }
    // }
    //
    // // Has to be separate since it may be moved to a team we don't have. We get this notification
    // // any time the platter team changes. The event comes in based on the oldTeam id.
    // onTeamPlatterMoveFromTeam(msg:{ from: User, platter: ClientPlatter, oldTeam: string }) {
    //     if (msg.from.id !== this.user.id) {
    //         // If we have access to the new team, then we don't bother do anything -
    //         // onTeamPlatterMovedToTeam will handle that. If we don't we need to remove
    //         // the platter.
    //         let foundTeam = null;
    //         for (let team of this.teamsService.cache) {
    //             if (team.id === msg.platter.team) {
    //                 foundTeam = team;
    //                 break;
    //             }
    //         }
    //         if (!foundTeam) {
    //             // Did not have the team - remove the platter from cache
    //             this.platterService.removeFromCache(msg.platter.id);
    //         }
    //     }
    // }

    // Includes archived. Does NOT include moving teams
    onTeamPlatterEdited(msg:{ from: ClientTeamMember, teamId: string, platter: ClientPlatter }) {
        if (msg.from.id !== this.user.id) {
            this.platterService.updateFromSocket(this.platterService.transformForUI(msg.platter));
            this.refreshTeamRelativePlatters();
        }
    }

    onTeamPlatterPlatesPosition(msg:{ from: ClientTeamMember, teamId: string, platter: string, positions: ListPositionArrayIdAndPos[] }) {
        if (msg.from.id !== this.user.id) {
            let uiClientPlatter = this.platterService.getFromCache(msg.platter);
            if (uiClientPlatter) {
                uiClientPlatter.plates.applyListPositions(msg.positions);
            }
        }
    }

    onTeamPlatterPlatesMoveOut(msg:{ from: ClientTeamMember, plate: string, teamId: string, platter: string, positions: ListPositionArrayIdAndPos[] }) {
        if (msg.from.id !== this.user.id) {
            let uiClientPlatter = this.platterService.getFromCache(msg.platter);
            if (uiClientPlatter) {
                uiClientPlatter.plates.removeById(msg.plate);
            }
        }
    }

    onNewActivity(msg:{ from: ClientTeamMember, activity: ClientActivity }) {
        console.log('new activity');
        console.log(msg.activity);
        let uiClientActivity = this.activityService.addToCache(msg.activity);
        this.addActivityToPlateAndPlatterIfNecessary(uiClientActivity);
    }

    onNewNotification(msg: {notification: ClientNotification}) {
        this.notificationsService.onSocketNewNotification(msg.notification);
    }

    onNewItemFromAutomationRule(msg: {connectedApp: string, plateItem: ClientPlateItem}) {
        if (msg && msg.plateItem && msg.plateItem.plate) {
            let plateId = msg.plateItem.plate;
            let plateComponent = this.platesService.getPlateComponentIfOpen(plateId);
            if (plateComponent) {
                plateComponent.insertNewItemFromAutomationRule(msg.plateItem);
            }
        }
    }

}
