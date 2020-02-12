import {Component, OnInit, EventEmitter, AfterViewInit} from "@angular/core";
import {PlatesService, BuiltInColors} from "../../shared/api/plates.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {
    PlateItemsService,
    UIClientPlateItem,
    ClientPlateItem,
    ClientConnectedAppAttachment,
    AddingItemLocation
} from "../../shared/api/plateitems.service";
import {BasePlateComponent, ISearchableBasePlateComponent} from "../baseplate.component";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {
    NativeDragDropPlate,
    PlateDragDropService,
    IDraggableConnectedAppComponent,
    ScrollDirection
} from "../plate-drag-drop.service";
import {PlateLocalStorageService} from "../../shared/utils/platelocalstorage.service";
import {ClientGmailMessage} from "../../shared/integrations/gmail/plate-integration-gmail.service";
import {ConnectedAppItemsService} from "../../shared/api/connectedappitems.service";
import {EditingPlateItemService} from "./item-edit/editing-plate-item.service";
import {SocketService} from "../../shared/socket/socket.service";
import {SearchResult, PlateSearchService} from "../../shared/api/search.service";
import {HomePlateService} from "../../+home/homeplate.service";
import {UIClientPlate, IPlateHeader} from "../../shared/api/plate.model";
import {ClientConnectedAppType} from "../../shared/api/connectedapp.model";
import {ConnectedAppsService} from "../../shared/api/connectedapps.service";
import {
    PlateIntegrationSlackServiceStatic, UIClientSlackPlateMessage
} from "../../shared/integrations/slack/plate-integration-slack.service";
import {SlackDragAndDropItemDetail} from "../slack/slack-plate.component";
import {BodyDropdownService} from "../../shared/utils/bodyDropdown.directive";
import {PlatterService} from "../../shared/api/platter.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {FilterService} from "../../shared/utils/filter.service";
import {ActivityService, UIClientActivity} from "../../shared/api/activity.service";
import {ClientTeamMember} from "../../shared/api/teams.service";

enum PlateMode {
    Default,
    Settings
}

@Component({
    providers: [PlateItemsService], // Every Plate component has an instance of PlateItemsService for caching
    moduleId: module.id,
    selector: 'plate-plate',
    templateUrl: `/ps/app/+plates/native/plate.component.html`
})
export class PlateComponent extends BasePlateComponent<UIClientPlate> implements OnInit, AfterViewInit, NativeDragDropPlate, ISearchableBasePlateComponent {

    private user: LoggedInUser;
    private userId: string;
    items: {
        [headerId: string]: UIClientPlateItem[]
    } = {};

    PLATEDEBUG = (<any>window).PLATEDEBUG || {};

    // These are ready by the dom and must be string
    cannotDragItems: string = null;
    canDragItemsOut: string = null;
    canAddItems: string = null;
    canModifyItems: string = null;
    canArchiveItems: string = null;
    canModifyPlate: string = null;
    canArchivePlate: string = null;

    itemsCurrentlyBeingAdded: {[headerName: string]: UIClientPlateItem} = {};
    //private connectedAppPlateTaskBeingAdded: { connectedAppComponent: IDraggableConnectedAppComponent<any>, appTask: UIClientConnectedAppItem }; // One at a time
    itemCurrentlyBeingLinkedTo: UIClientPlateItem;

    itemBeingQuickEdited: {
        originalTitle: string,
        item: UIClientPlateItem
    };
    PlateMode = PlateMode;
    mode: PlateMode = PlateMode.Default;
    newItemFocus: EventEmitter<any> = new EventEmitter();
    editingTitleAdHoc: boolean = false;
    editingPlateName = '';
    editingColor = false;
    colors = BuiltInColors;
    AddingItemLocation = AddingItemLocation;

    addingHeader: IPlateHeader;
    deletingHeaderCandidate: IPlateHeader;

    ClientConnectedAppType = ClientConnectedAppType;

    // ViewChild and ngIfs suck
    $getElementSelf() { return $('#' + this.base.model.id) }
    $getPlateContentWrapper() { return this.$getElementSelf().find('[plate-content-wrapper]') }

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
        this.sortHeaders();
        this.user = this.plateAuthService.getUserInfo();
        this.userId = this.user.id;
        if (this.base.model.id) {
            // New plates won't have an id and doInit will be called manually on save
            this.doInit();
            this.platesService.registerOpenPlateComponent(this.base.model.id, this);
            this.activityService.registerForActivityClickedForPlateItem(this);
        } else {
            // New plate, edit title immediately
            this.editingTitleAdHoc = true;
        }
    }
    doInit() {
        if (this.plateItemsService.objectCache && Object.keys(this.plateItemsService.objectCache).length) {
            this.items = this.plateItemsService.objectCache;
        } else {
            this.plateItemsService.getCache(null, null, this.base.model.id).subscribe((items) => {
                this.items = this.plateItemsService.objectCache;
            }, error => this.plateErrorHandler.error(error, 'in plate component get cache items'))
        }

        this.plateDragDropService.register(ClientConnectedAppType.Native, this);

        let thisPlate: UIClientPlate = <UIClientPlate>this.base;
        let platter = thisPlate.platter;
        if (platter.model.team && platter.model.team.length) {
            this.socketService.registerForTeamPlate(this);
            this.socketService.listenForTeamPlateEvents({ plateId: thisPlate.model.id });
        }

        this.canAddItems = platter.canCreatePlateItems(this.user) ? '1' : null;
        this.canModifyItems = platter.canModifyPlateItems(this.user) ? '1' : null;
        this.cannotDragItems = this.canModifyItems ? null : '1';
        this.canDragItemsOut = platter.canMovePlateItemsToDiffPlate(this.user) ? '1' : null;
        this.canArchiveItems = platter.canArchivePlateItems(this.user) ? '1' : null;
        this.canModifyPlate = platter.canModifyPlates(this.user) ? '1': null;
        this.canArchivePlate = platter.canArchivePlates(this.user) ? '1': null;

        this.searchService.registerForEvent(this);
    }

    ngAfterViewInit() {
        // ViewChild sucks, ngAfterViewInit sucks, just wait one second
        setTimeout(() => {
            this.plateDragDropService.listenForScrollEdges(this.base.model.id, 'plateId', this.$getPlateContentWrapper(), ScrollDirection.Vertical);
        }, 1000);
    }

    onClose() {
        if (this.base.model.id) {
            this.activityService.unregisterForActivityClickedForPlateItem(this);
            this.platesService.unregisterOpenPlateComponent(this.base.model.id);
            this.searchService.unregisterForEvent(this);
            this.socketService.unregisterForTeamPlate(this);
        } else {
            this.homePlateService.emitAddingPlateClosed();
        }
    }
    ngOnDestroy() {
        this.onClose();
    }
    private doCloseForEmptyTitleNewPlate() {
        this.onClose();
    }

    insertNewItemFromAutomationRule(plateItem: ClientPlateItem) {
        this.plateItemsService.insertFromSocketEvent(plateItem);
    }

    // onPin() {
    //
    // }
    // onDock() {
    //     let isDocked = this.base.isDocked();
    //     if (isDocked) {
    //
    //     } else {
    //
    //     }
    // }
    // onMinimize() {
    //     let isMinimized = this.base.isMinimized();
    //     if (isMinimized) {
    //
    //     } else {
    //
    //     }
    // }

    private addNewItemToUI = (newItem: UIClientPlateItem) => {
        let items = this.items[newItem.model.header];
        if (!items) {
            items = this.items[newItem.model.header] = [];
        }
        items.splice(newItem.model.pos, 0, newItem);
        for (let i = newItem.model.pos+1; i < items.length; i++) {
            items[i].model.pos++;
        }
        return newItem;
    }
    newItem(item: UIClientPlateItem, header: IPlateHeader): Promise<UIClientPlateItem> {
        return new Promise((resolve, reject) => {
            if (item.isAdding === this.AddingItemLocation.Bottom) {
                let items = this.items[header.id];
                if (items && items.length) {
                    item.model.pos = items.length;
                }
            }
            let newItem = this.addNewItemToUI(<UIClientPlateItem>item);
            this.plateItemsService.save(item, this.base.model.id).subscribe((serverItem) => {
                newItem.model.id = serverItem.model.id;
                resolve(newItem);
            }, (error) => {
                reject(error);
            });
        });
    }
    updateItemForNewLinkedAttachment(item: UIClientPlateItem, header: IPlateHeader): Promise<UIClientPlateItem> {
        return new Promise((resolve, reject) => {
            this.plateItemsService.update(item).subscribe((status) => {
                resolve(item);
            }, (error) => {
                reject(error);
            });
        });
    }

    private removeItemFromUI = (item: UIClientPlateItem, headerId: string) => {
        let items = this.items[headerId];
        items.splice(item.model.pos, 1);
        for (let i = item.model.pos; i < items.length; i++) {
            items[i].model.pos--;
        }
    }
    removeItem (item: UIClientPlateItem, header: IPlateHeader) {

    }

    /**
     * Uses the connectedAppPlateTaskBeingAdded field
     */
    // createOpenTaskForGmailPlate() {
    //     let connectedAppId = this.connectedAppPlateTaskBeingAdded.connectedAppComponent.base.model.id;
    //     let userId = this.plateAuthService.getUserInfo().id;
    //     this.connectedAppItemsService.save(this.connectedAppPlateTaskBeingAdded.appTask, userId, connectedAppId).subscribe((connectedAppItem) => {
    //         this.connectedAppPlateTaskBeingAdded.connectedAppComponent.refreshOpenTasks();
    //         this.removeOpenTaskForGmailPlate();
    //     }, error => this.plateErrorHandler.error(error, 'create open task for gmail plate'));
    // }

    /**
     * Clears the connectedAppPlateTaskBeingAdded field
     */
    // removeOpenTaskForGmailPlate() {
    //     this.connectedAppPlateTaskBeingAdded = null;
    // }

    quickEditSave(item: UIClientPlateItem, header: IPlateHeader): Promise<UIClientPlateItem> {
        return new Promise((resolve, reject) => {
            this.plateItemsService.update(item).subscribe((status) => {
                this.destroyQuickEdit(false);
                resolve(item);
            }, (error) => {
                reject(error);
            });
        });
    }

    establishQuickEdit(item: UIClientPlateItem) {
        this.destroyQuickEdit(true);
        item.quickEditing = true;
        this.itemBeingQuickEdited = {
            originalTitle: item.model.title,
            item: item
        }
    }

    destroyQuickEdit(revert: boolean) {
        if (this.itemBeingQuickEdited) {
            if (revert) {
                this.itemBeingQuickEdited.item.model.title = this.itemBeingQuickEdited.originalTitle;
            }
            this.itemBeingQuickEdited.item.quickEditing = false;
        }
    }

    // ------------------------------------------------------------------- UI Events
    archiveItemClicked(item: UIClientPlateItem, header: IPlateHeader) {
        if (!item.model.archived) {
            item.model.archived = true;
            this.plateItemsService.update(item).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in archive plate item'));
            // Special case for removing the dropdown after a certain time
            // Otherwise it yells at us
            setTimeout(() => {
                this.removeItemFromUI(item, header.id);
            }, 10);
        }
        Analytics.default('Archive Plate Item', 'archiveItemClicked()');
    }
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

    headerClicked(header: IPlateHeader) {
        this.editingPlateName = this.base.model.name;
        this.mode = PlateMode.Settings;
        Analytics.default('Plate Header Clicked Go to Settings', 'headerClicked()');
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

    settingAddHeaderClicked() {
        this.addingHeader = {
            name: '',
            editName: ''
        }
    }
    private applySettingsNewHeader() {
        if (this.addingHeader && this.addingHeader.editName) {
            let duplicateHeader = false;
            for (let header of this.base.model.headers) {
                if (header.name === this.addingHeader.name) {
                    duplicateHeader = true;
                    break;
                }
            }
            if (!duplicateHeader) {
                let newName = this.addingHeader.editName.trim();
                this.platesService.createHeader(this.userId, this.base.model.id, newName).subscribe((header) => {
                    this.base.model.headers.push(header);
                    this.sortHeaders();
                }, err => this.plateErrorHandler.error(err, 'in save new header'));
            }
        }
        this.addingHeader = null;
        Analytics.default('Plate Header Created', 'applySettingsNewHeader()');
    }
    settingsNewHeaderEnterPressed($event) {
        $event && $event.preventDefault();
        this.applySettingsNewHeader();
    }

    settingsItemCanBeMarkedDoneClicked(header: IPlateHeader) {
        // Ng checkboxes take a second to update - so this will be clicked,
        // THEN the value will be updated after the click
        let value = !header.itemsCanBeDone;

        this.platesService.toggleItemsCanBeMarkedAsDone(this.userId, this.base.model.id, header.id, value).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, 'in save items acn be marked as done for ehader'));
        Analytics.default('Plate Items Marked As Done Toggle', 'settingsItemCanBeMarkedDoneClicked()');
    }

    settingsRemoveHeaderClicked(header: IPlateHeader) {
        this.deletingHeaderCandidate = header;
        (<any>$(this.deleteHeaderConfirmDialog.nativeElement))
            .modal({
                onHide: () => { }
            })
            .modal('show');
    }
    settingsHideDoneHeaderClicked(header: IPlateHeader) {
        header.isFullyHidden = !header.isFullyHidden;
        this.platesService.fullyHideDoneHeaderToggle(this.userId, this.base.model.id, header.isFullyHidden).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, 'in save header fully hide'));
        header.editing = false;
        Analytics.default('Plate Header Fully Hide Done', 'settingsHideDoneHeaderClicked()');
    }
    settingsDoneEditingHeaderClicked(header: IPlateHeader) {
        this.applySettingsEditHeaderChanges(header);
        header.editing = false;
    }

    deleteHeaderConfirmClicked() {
        if (this.deletingHeaderCandidate) {
            for (let i = 0; i < this.base.model.headers.length; i++) {
                let plateHeader = this.base.model.headers[i];
                if (plateHeader.id === this.deletingHeaderCandidate.id) {
                    this.base.model.headers.splice(i, 1);
                    break;
                }
            }
            this.platesService.deleteHeader(this.userId, this.base.model.id, this.deletingHeaderCandidate.id).subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'in delete header'));
        }
        this.deletingHeaderCandidate = null;
        (<any>$(this.deleteHeaderConfirmDialog.nativeElement)).modal('hide');
        Analytics.default('Plate Header Delete', 'deleteHeaderConfirmClicked()');
    }
    nevermindHeaderConfirmClicked() {
        this.deletingHeaderCandidate = null;
        (<any>$(this.deleteHeaderConfirmDialog.nativeElement)).modal('hide');
    }

    settingsEditHeaderClicked(header: IPlateHeader) {
        header.editName = header.name;
        header.editing = true;
    }
    private applySettingsEditHeaderChanges(header: IPlateHeader) {
        let newName = header.editName && header.editName.trim();
        if (newName && newName.length && newName !== header.name) {
            this.platesService.updateHeaderName(this.userId, this.base.model.id, header.id, newName).subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'in save header name'));
            header.name = newName;
        }
        header.editing = false;
        Analytics.default('Plate Header Update Name', 'applySettingsEditHeaderChanges()');
    }
    settingsEditHeaderEnterPressed($event, header: IPlateHeader) {
        this.applySettingsEditHeaderChanges(header);
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

    private adHocTitleEdited() {
        if (this.editingTitleAdHoc) {
            // adHocTitleEditEnterPressed and adHocTitleEditInputBlurred both get called on enter, so
            // check for editingTitleAdHoc
            this.editingTitleAdHoc = false;
            if (this.base.model.id) {
                this.platesService.save(<any>this.base.model).subscribe((status) => {
                    // Do nothing
                }, err => this.plateErrorHandler.error(err, 'In save title plate1'));
            } else {
                // Creating a new plate
                if (this.base.model.name && this.base.model.name.length) {
                    this.platesService.save(<any>this.base.model).subscribe((plate: UIClientPlate) => {
                        plate.select(true, true, this.homePlateService);
                        this.platesService.addToCache(plate, this.platterService);
                        this.homePlateService.newPlateWasAdded(plate);
                        plate.model.listPos = plate.model.listPos || plate.platter.plates.length-1;
                    }, err => this.plateErrorHandler.error(err, 'In save title plate2'));
                } else {
                    this.doCloseForEmptyTitleNewPlate();
                }
            }
        }
    }
    adHocTitleEditEnterPressed() {
        this.adHocTitleEdited();
    }
    adHocTitleEditInputBlurred() {
        this.adHocTitleEdited();
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

    private setNewItemBeingAdded(header: IPlateHeader, addingItemLocation: AddingItemLocation) {
        if (this.itemsCurrentlyBeingAdded[header.name]) {
            this.itemsCurrentlyBeingAdded[header.name].isAdding = addingItemLocation;
        } else {
            this.itemsCurrentlyBeingAdded[header.name] = {
                isAdding: addingItemLocation,
                assignees: [],
                model: {
                    title: '',
                    owner: this.plateAuthService.getUserInfo().id,
                    plate: this.base.model.id,
                    header: header.id,
                    pos: 0,
                    metrics: [],
                    assignees: [],
                    fileAttachments: []
                }
            };
        }
        setTimeout(() => {
            this.newItemFocus.emit(null);
        }, 1);
    }

    headerAddButtonClicked(header: IPlateHeader) {
        this.setNewItemBeingAdded(header, this.AddingItemLocation.Top);
        Analytics.default('Item Add', header.name + ' Header');
    }

    addAtBottomButtonClicked(header: IPlateHeader) {
        this.setNewItemBeingAdded(header, this.AddingItemLocation.Bottom);
        Analytics.default('Item Add at Bottom', header.name + ' Header');
    }

    headerToggleHide(header: IPlateHeader) {
        header.isHidden = !header.isHidden;
        this.platesService.updateDoneHeader(this.base.model.id, header.isHidden).subscribe((status) => {
            // Do nothing
        }, err => this.plateErrorHandler.error(err, 'in change hidden status plate'));

        Analytics.default('Done Toggle Hide ' + header.isHidden, header.name + ' Header');
    }

    newItemEditClicked(header: IPlateHeader) {
        let item = this.itemsCurrentlyBeingAdded[header.name];
        if (!item.model.title) {
            item.model.title = 'New item';
        }
        this.newItem(item, header).then((newItem) => {
            this.editingPlateItemService.setItem(newItem, this.base.model.color, 'New Item', true);
        }).catch((reason) => {
            console.log('error in new item frmo edit click');
        })
        delete this.itemsCurrentlyBeingAdded[header.name];

    }

    newItemOkClicked(header: IPlateHeader) {
        let item = this.itemsCurrentlyBeingAdded[header.name];
        if (item.model.title) {
            this.newItem(item, header);
        }
        delete this.itemsCurrentlyBeingAdded[header.name];
    }

    newItemCloseIconClicked(header: IPlateHeader) {
        delete this.itemsCurrentlyBeingAdded[header.name];
    }

    newItemEnterPressed($event, header: IPlateHeader) {
        $event.preventDefault();
        let item = this.itemsCurrentlyBeingAdded[header.name];
        let location = item.isAdding;
        if (item.model.title) {
            this.newItem(item, header);
        }
        delete this.itemsCurrentlyBeingAdded[header.name];
        this.setNewItemBeingAdded(header, location);
    }

    newItemExitPressed($event, header: IPlateHeader) {
        if (this.itemsCurrentlyBeingAdded[header.name]) {
            this.itemsCurrentlyBeingAdded[header.name].isAdding = this.AddingItemLocation.None;
        }
    }

    newItemBlurred($event, header: IPlateHeader) {
        console.log($event);
        let doBlur = false;
        if (!$event) {
            doBlur = true;
        } else {
            let $target = $($event.relatedTarget);
            if (
                !$target.closest('[new-item-ok-button]').length &&
                !$target.closest('[new-item-edit-button]').length
            ) {
                doBlur = true;
            }
        }

        if (doBlur) {
            if (this.itemsCurrentlyBeingAdded[header.name]) {
                this.itemsCurrentlyBeingAdded[header.name].isAdding = this.AddingItemLocation.None;
            }
        }

    }

    itemConfirmMessageClicked(item: UIClientPlateItem, header: IPlateHeader) {
        item.confirm = null;
        if (!this.itemCurrentlyBeingLinkedTo) {
            this.removeItemFromUI(item, header.id);
            this.newItem(item, header).then((uiClientPlateItem) => {
                this.establishQuickEdit(uiClientPlateItem);
                //this.createOpenTaskForGmailPlate();
            }).catch(reason => this.plateErrorHandler.error(reason, 'item confirm message clicked'));
        } else {
            this.updateItemForNewLinkedAttachment(item, header).then((uiClientPlateItem) => {
                //this.createOpenTaskForGmailPlate();
            }).catch(reason => this.plateErrorHandler.error(reason, 'item confirm message clicked for linked attachment add'));
        }
        this.itemCurrentlyBeingLinkedTo = null;
        Analytics.default('Item Add Share Team Confirmation', 'itemConfirmMessageClicked()');
    }

    itemConfirmNevermindClicked(item: UIClientPlateItem, header: IPlateHeader) {
        item.confirm = null;
        if (!this.itemCurrentlyBeingLinkedTo) {
            this.removeItemFromUI(item, header.id);
        } else {
            // Remove its attachment that we just added
            let connectedAppAttachments = this.itemCurrentlyBeingLinkedTo.model.connectedAppAttachments;
            connectedAppAttachments.pop();
        }
        //this.removeOpenTaskForGmailPlate();
        this.itemCurrentlyBeingLinkedTo = null;
        Analytics.default('Item Add Nevermind Team Confirmation', 'itemConfirmNevermindClicked()');
    }

    quickEditEnterPressed($event, item: UIClientPlateItem, header: IPlateHeader) {
        $event.preventDefault();
        if (item.model.title && item.model.title === this.itemBeingQuickEdited.originalTitle) {
            this.destroyQuickEdit(true);
        } else {
            this.quickEditSave(item, header);
        }
    }

    quickEditCloseIconClicked(item: UIClientPlateItem, header: IPlateHeader) {
        this.destroyQuickEdit(true);
    }

    quickEditOkClicked(item: UIClientPlateItem, header: IPlateHeader) {
        if (!item.model.title || item.model.title === this.itemBeingQuickEdited.originalTitle) {
            this.destroyQuickEdit(true);
        } else {
            this.quickEditSave(item, header);
        }
    }

    quickEditEditClicked(item: UIClientPlateItem, header: IPlateHeader) {
        this.quickEditSave(item, header).then((item) => {
            this.editingPlateItemService.setItem(item, this.base.model.color, 'Edit Item', true);
        }).catch((reason) => {
            console.log('error in quick edit edit clicked');
        })
    }

    itemClicked($event: any, item: UIClientPlateItem) {
        if (!item.model.archived) {
            let $target = $($event.target);
            if(
                !$target.closest('[item-checkbox]').length &&
                !$target.closest('[menu-button-wrapper]').length &&
                !$target.closest('[ok-button]').length &&
                !$target.closest('[edit-button]').length &&
                !$target.closest('[item-confirm-message-button]').length &&
                !$target.closest('[item-confirm-nevermind-button]').length
            ) {
                this.editingPlateItemService.setItem(item, this.base.model.color, 'Edit item', true);
            }
        }
        Analytics.default('Item Edit Clicked', 'itemClicked()');
    }

    private moveToFirstHeader(item: UIClientPlateItem) {
        let firstHeader = this.base.model.headers[0].id;
        // These will be updated on the server from the move - just reflected here in the UI for speed
        item.model.previousHeader = firstHeader;
        item.model.previousPlate = this.base.model.id;
        this.simulateDragAndDropFromAndToSame(item, this.base.model.headers[0].id, 0);
    }
    checkboxClicked(header: IPlateHeader, item: UIClientPlateItem) {
        if (!header.isDoneHeader) {
            // This was not in the done list, move in there
            let doneHeader: IPlateHeader;
            for (let header of this.base.model.headers) {
                if (header.isDoneHeader) {
                    doneHeader = header;
                    break;
                }
            }
            // These will be updated on the server from the move - just reflected here in the UI for speed
            item.model.previousHeader = item.model.header;
            item.model.previousPlate = item.model.previousPlate;

            // Marked done is purely for performance on the server
            item.model.markedDone = true;
            this.simulateDragAndDropFromAndToSame(item, doneHeader.id, 0);

            Analytics.default('Item Mark Done', header.name + ' Header');
        } else {
            // This was in the done list, move it out

            // If it's in Done, previousPlate and previousHeader will
            // exist. If for some reason they don't, just move to the
            // first header.
            item.model.markedDone = false;

            if (!item.model.previousHeader) {
                console.log('no previous header');
                console.log(item);
                this.moveToFirstHeader(item);

            } else {
                // Later we will implement this to where it moves to its previous plate and header
                // when they are different, but for now just move back to its original header if
                // it exists on this plate. If not, move up.
                let headerExistsOnThisPlate = false;
                for (let header of this.base.model.headers) {
                    if (header.id === item.model.previousHeader) {
                        headerExistsOnThisPlate = true;
                    }
                }
                if (!headerExistsOnThisPlate) {
                    this.moveToFirstHeader(item);
                } else {
                    this.simulateDragAndDropFromAndToSame(item, item.model.previousHeader, 0);
                }
            }

            Analytics.default('Item Mark Undone', header.name + ' Header');
        }
    }

    // ------------------------------------------------------------------- Search event

    searchResultClicked(result: SearchResult, callback: (plateItem: UIClientPlateItem) => void) {
        // The dialog is opened by the top bar component (regardless)
        // This is here to hand the top bar the item, which is owned by this Plate.
        if (this.base.isMinimized()) {
            this.base.minimize(false, true, this.homePlateService);
        }
        let clientPlateItem: ClientPlateItem = result.model;
        let items = this.items[clientPlateItem.header];
        for (let item of items) {
            if (item.model.id === clientPlateItem.id) {
                callback(item);
                break;
            }
        }
        Analytics.default('Plate Search Result Clicked', 'searchResultClicked()');
    }

    // ------------------------------------------------------------------- Drag and drop

    private simulateDragAndDropFromAndToSame(item: UIClientPlateItem, newHeaderId: string, newPos: number) {
        item.hovering = false;
        item.hoveringOverCheckbox = false;
        this.itemDroppedFromSame(newHeaderId, item.model.header, item.model.id, newPos);
    }

    itemDroppedFromSame(targetHeaderId: string, fromHeaderId: string, draggingElId: string, newPosition: number) {
        let item = this.items[fromHeaderId].filter(item => item.model.id === draggingElId)[0];
        this.plateItemsService.updatePosition(true, this.base.model.id, fromHeaderId, item, newPosition, targetHeaderId)
            .subscribe((status) => {
        	// Do nothing
        }, error => this.plateErrorHandler.error(error, 'plate items service update position plate component'));
        Analytics.default('Item Moved Same Plate', 'itemDroppedFromSame()');
    }

    itemDroppedFromRemote(fromPlate: NativeDragDropPlate, fromHeaderId: string, targetHeaderId: string, draggingElId: string, newPosition: number) {
        console.log('new pos ' + newPosition);
        let isDoneHeader = false;
        for (let header of this.base.model.headers) {
            if (header.isDoneHeader) {
                if (targetHeaderId === header.id) {
                    isDoneHeader = true;
                }
                break;
            }
        }
        this.plateItemsService.moveFromRemote(this.base.model.id, targetHeaderId, fromPlate.getItemsForHeader(fromHeaderId), draggingElId, newPosition, isDoneHeader)
            .subscribe((status) => {
                // Do nothing
            }, error => this.plateErrorHandler.error(error, 'item dropped from remote'));
        Analytics.default('Item Moved to Different Plate', 'itemDroppedFromRemote()');
    }

    itemDragged(bagName: string, draggingEl: HTMLElement, fromBagEl: HTMLElement) {
        console.log('dragged');
        console.log(arguments);
    }

    itemDraggedOver(bagName: string, draggingEl: HTMLElement, targetBagEl: HTMLElement, fromBagEl: HTMLElement, newEl: HTMLElement) {
        // It is not apparent if targetBagEl is right in this method
        console.log('dragged over');
        console.log(arguments);
    }

    itemDraggedOut(bagName: string, draggingEl: HTMLElement, targetBagEl: HTMLElement, fromBagEl: HTMLElement) {
        // Called when dragging an el to another bag, and also apparently on drop
        console.log('dragged out');
        console.log(arguments);
    }

    // TODO - Clean all this drag drop crap up
    getItemsForHeader(headerId: string) {
        return this.items[headerId];
    }

    getItemById(id: string) {
        for (let key in this.items) {
            for (let item of this.items[key]) {
                if (item.model.id === id) {
                    return item;
                }
            }
        }
    }

    // ------------------------------------------------------------------- Connected App Events

    gmailItemDropped(targetHeaderId: string, position: number, gmailMessage: ClientGmailMessage, itemContent: string, gmailPlate: IDraggableConnectedAppComponent<ClientGmailMessage>, itemToLink: UIClientPlateItem) {
        let item: UIClientPlateItem = null;
        let connectedAppAttachmentObj: ClientConnectedAppAttachment = {
            app: ClientConnectedAppType.Gmail,

            // Shows up in UI:
            title: gmailMessage.from,
            subtitle: gmailMessage.subject,
            content: itemContent,

            identifier: gmailMessage.id,
            connectedAppId: gmailPlate.base.model.id,
            itemDate: gmailMessage.date,

            // Custom:
            customIds: [],
            customDates: [],
            customDetails: [gmailMessage.toFull]
        };

        if (!itemToLink) {
            item = {
                assignees: [],
                model: {
                    title: `${gmailMessage.subject}`,
                    owner: this.plateAuthService.getUserInfo().id,
                    plate: this.base.model.id,
                    header: targetHeaderId,
                    pos: position,
                    connectedAppAttachments: [
                        connectedAppAttachmentObj
                    ],
                    metrics: [],
                    assignees: [],
                    fileAttachments: []
                }
            }
        } else {
            item = itemToLink;
            item.model.connectedAppAttachments = item.model.connectedAppAttachments || [];
            item.model.connectedAppAttachments.push(connectedAppAttachmentObj);
            this.itemCurrentlyBeingLinkedTo = item;
        }

        console.log(gmailMessage);

        let doSave = false;
        let thisPlate = <UIClientPlate>this.base;
        //let platter = this.platterService.getPlatterFromCache(thisPlate.model.platter);
        let platter = thisPlate.platter;
        if (platter && platter.model.team) {
            item.confirm = {
                message: `Linking this email will share its details with everyone who can see the shared Plate "${this.base.model.name}".`
            }
        } else {
            doSave = true;
        }

        const header = this.base.model.headers.filter(header => header.id === targetHeaderId)[0];
        // this.connectedAppPlateTaskBeingAdded = {
        //     connectedAppComponent: gmailPlate,
        //     appTask: {
        //         model: {
        //             title: gmailMessage.from,
        //             subtitle: gmailMessage.subject,
        //             text: gmailMessage.snippet,
        //             connectedId: gmailMessage.id,
        //             connectedAppId: gmailPlate.base.model.id,
        //         }
        //     }
        // }
        if (doSave) {
            if (!this.itemCurrentlyBeingLinkedTo) {
                this.newItem(item, header).then((uiClientPlateItem) => {
                    this.establishQuickEdit(uiClientPlateItem);
                    //this.createOpenTaskForGmailPlate();
                }).catch(error => this.plateErrorHandler.error(error, 'do save new item'))
            } else {
                this.updateItemForNewLinkedAttachment(item, header).then((uiClientPlateItem) => {
                    //this.createOpenTaskForGmailPlate();
                }).catch(reason => this.plateErrorHandler.error(reason, 'item saved for linked attachment add'));
                this.itemCurrentlyBeingLinkedTo = null;
            }
        } else {
            if (!this.itemCurrentlyBeingLinkedTo) {
                this.addNewItemToUI(item);
            }
        }

        Analytics.default('Gmail Item Moved to Plate', 'gmailItemDropped()');
    }

    slackItemDropped(targetHeaderId: string, position: number, slackItem: UIClientSlackPlateMessage, itemContent: SlackDragAndDropItemDetail, slackPlate: IDraggableConnectedAppComponent<UIClientSlackPlateMessage>, itemToLink: UIClientPlateItem) {
        let item: UIClientPlateItem = null;

        let connectedAppAttachmentObj: ClientConnectedAppAttachment = {
            app: ClientConnectedAppType.Slack,

            // Shows up in UI:
            title: slackItem.model.userObj.name ? slackItem.model.userObj.name : slackItem.model.username ? slackItem.model.username : 'Slack Message',
            subtitle: slackItem.model.text,
            content: itemContent.itemWithSubmessagesContent,

            identifier: slackItem.model.ts,
            connectedAppId: slackPlate.base.model.id,
            itemDate: PlateIntegrationSlackServiceStatic.getDateForSlackWeirdTimestamp(slackItem.model.ts).getTime(),

            // Custom:
            customIds: [],
            customDates: [],
            customDetails: [itemContent.channelName]
        };

        if (!itemToLink) {
            item = {
                assignees: [],
                model: {
                    title: `Respond to ${connectedAppAttachmentObj.title}`,
                    owner: this.plateAuthService.getUserInfo().id,
                    plate: this.base.model.id,
                    header: targetHeaderId,
                    pos: position,
                    connectedAppAttachments: [
                        connectedAppAttachmentObj
                    ],
                    metrics: [],
                    assignees: [],
                    fileAttachments: []
                }
            }
        } else {
            item = itemToLink;
            item.model.connectedAppAttachments = item.model.connectedAppAttachments || [];
            item.model.connectedAppAttachments.push(connectedAppAttachmentObj);
            this.itemCurrentlyBeingLinkedTo = item;
        }

        let doSave = false;
        let thisPlate = <UIClientPlate>this.base;
        //let platter = this.platterService.getPlatterFromCache(thisPlate.model.platter);
        let platter = thisPlate.platter;
        if (platter && platter.model.team) {
            item.confirm = {
                message: `Linking this Slack message will share its details with everyone who can see the shared Plate "${this.base.model.name}".`
            }
        } else {
            doSave = true;
        }

        const header = this.base.model.headers.filter(header => header.id === targetHeaderId)[0];
        if (doSave) {
            if (!this.itemCurrentlyBeingLinkedTo) {
                this.newItem(item, header).then((uiClientPlateItem) => {
                    this.establishQuickEdit(uiClientPlateItem);
                    //this.createOpenTaskForGmailPlate();
                }).catch(error => this.plateErrorHandler.error(error, 'do save new item'))
            } else {
                this.updateItemForNewLinkedAttachment(item, header).then((uiClientPlateItem) => {
                    //this.createOpenTaskForGmailPlate();
                }).catch(reason => this.plateErrorHandler.error(reason, 'item saved for linked attachment add'));
                this.itemCurrentlyBeingLinkedTo = null;
            }
        } else {
            if (!this.itemCurrentlyBeingLinkedTo) {
                this.addNewItemToUI(item);
            }
        }

        Analytics.default('Slack Item Moved to Plate', 'slackItemDropped()');
    }

    onMouseOverPlateItem(item: UIClientPlateItem) {
        item.hovering = true;
        item.userAckedActivities = true;
        if (item.activities) {
            for (let key in item.activities) {
                this.activityService.acknowledge(item.activities[key]);
            }
        }
    }

    onActivityClickedForPlateItem(activity: UIClientActivity) {
        let item = this.getItemById(activity.model.item);
        if (item) {
            item.userAckedActivities = true;
            if (item.activities) {
                for (let key in item.activities) {
                    this.activityService.acknowledge(item.activities[key]);
                }
            }
        }
    }

    // ------------------------------------------------------------------- UI State

    itemHasActivities(item: UIClientPlateItem) {
        return item.activities && Object.keys(item.activities).length;
    }

    canEdit() {
        // if (this.base.model.owner === this.userId) {
        //     return true;
        // }
        //
        // let thisPlate: UIClientPlate = this.base;
        // //let platter = this.platterService.getPlatterFromCache(thisPlate.model.platter);
        // let platter = thisPlate.platter;
        // let teamId = platter && platter.model.team;
        // if (teamId) {
        //     let teamFromUser = this.plateAuthService.getUserInfo().teams.map((userTeam) => {
        //         return userTeam.id === teamId ? userTeam : null;
        //     })[0];
        //     if (teamFromUser) {
        //         return teamFromUser.role === 'admin';
        //     } else {
        //         return false;
        //     }
        // }
        return true;
    }

    addingItemForHeader(header: IPlateHeader, location?: AddingItemLocation) {
        if (!location) {
            return this.itemsCurrentlyBeingAdded[header.name] && this.itemsCurrentlyBeingAdded[header.name].isAdding !== this.AddingItemLocation.None;
        } else {
            return this.itemsCurrentlyBeingAdded[header.name] && this.itemsCurrentlyBeingAdded[header.name].isAdding === location;
        }
    }

    getItemsForHeaderId(headerId: string) {
        // let ret = [];
        // for (let item of this.items[headerId]) {
        //     if (item.model.status === status) {
        //         ret.push(item);
        //     }
        // }
        // return ret;
        return this.items[headerId] || [];
    }

    // ------------------------------------------------------------------- Socket events
    onTeamPlateItemAdded (msg: { from: ClientTeamMember, plateItem: ClientPlateItem }) {
        if (msg.from && msg.from.id === this.userId) {
            // Do nothing
        } else {
            let uiClientPlateItem = this.plateItemsService.insertFromSocketEvent(msg.plateItem);
            if (uiClientPlateItem && !Object.keys(uiClientPlateItem.activities).length) {
                this.activityService.needsActivity(uiClientPlateItem);
            }
        }
    }

    onTeamPlateItemPositionUpdated (msg: { from: ClientTeamMember, plateItem: ClientPlateItem, oldHeader: string }) {
        // TODO test with multiple team plates
        if (msg.from && msg.from.id === this.userId) {
            // Do nothing
            return;
        }
        let serverPlateItem = msg.plateItem;
        let plateId = serverPlateItem.plate;
        let targetHeaderId = serverPlateItem.header;
        let fromHeader = msg.oldHeader;
        let newPosition = serverPlateItem.pos;
        let existingPlateItem: UIClientPlateItem = null;
        let items = this.plateItemsService.objectCache[fromHeader];
        for (let item of items) {
            if (item.model.id === serverPlateItem.id) {
                existingPlateItem = item;
                break;
            }
        }
        this.plateItemsService.updatePosition(false, plateId, fromHeader, existingPlateItem, newPosition, targetHeaderId);
    }

    onTeamPlateItemEdited(msg: { from: ClientTeamMember, plateItem: ClientPlateItem }) {
        if (msg.from && msg.from.id === this.userId) {
            // Do nothing
            return;
        }
        let existingPlateItem: UIClientPlateItem = null;
        let serverPlateItem = msg.plateItem;
        let items = this.plateItemsService.objectCache[msg.plateItem.header];
        for (let item of items) {
            if (item.model.id === serverPlateItem.id) {
                existingPlateItem = item;
                break;
            }
        }

        let wasArchived = existingPlateItem.model.archived;

        // Update each property that would be affected by a non move
        // Later put this in a function
        existingPlateItem.model.title = serverPlateItem.title;
        existingPlateItem.model.archived = serverPlateItem.archived;
        existingPlateItem.model.metrics = serverPlateItem.metrics;
        existingPlateItem.model.connectedAppAttachments = serverPlateItem.connectedAppAttachments;
        existingPlateItem.model.due = serverPlateItem.due;
        existingPlateItem.model.modified = serverPlateItem.modified;
        existingPlateItem.model.numComments = serverPlateItem.numComments;

        this.plateItemsService.updateUiItemMetrics(existingPlateItem);

        if (!wasArchived && existingPlateItem.model.archived) {
            this.removeItemFromUI(existingPlateItem, existingPlateItem.model.header);
        } else {
            // The item will have an activity regardless.
            existingPlateItem.userAckedActivities = false;
            // What is not guaranteed is that the activity got to the client before this socket event.
            let activities = this.activityService.getUnacknowledgedActivities(existingPlateItem.model.id);
            if (activities.length) {
                // The item may have any number of unacked activities on it currently.
                // We want to add any we didn't know about.
                // If we knew about all of them, we will need to register with the activity service
                // so that when an activity comes in, it will add it to this item.
                let knewOfAllActivities = true;
                for (let activity of activities) {
                    if (!existingPlateItem.activities[activity.model.id]) {
                        knewOfAllActivities = false;
                        existingPlateItem.activities[activity.model.id] = activity;
                    }
                }
                if (knewOfAllActivities) {
                    this.activityService.needsActivity(existingPlateItem);
                }
            } else {
                this.activityService.needsActivity(existingPlateItem);
            }
        }
    }

    onTeamPlateItemRemovedFromPlate(msg: { from: ClientTeamMember, plateItem: ClientPlateItem, oldPlate: string, oldHeader: string }) {
        if (msg.from && msg.from.id === this.userId) {
            // Do nothing
        } else {
            this.plateItemsService.removeFromSocketEvent(msg.oldHeader, msg.plateItem);
        }
    }

}