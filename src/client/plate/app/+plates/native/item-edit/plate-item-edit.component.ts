import {Component, OnInit, ViewChild, ElementRef} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {
    UIClientPlateItem,
    PlateItemsService,
    ClientConnectedAppAttachment,
    ClientMetric,
    MetricOwnerType,
    ClientFileAttachment
} from "../../../shared/api/plateitems.service";
import {EditingPlateItemService} from "./editing-plate-item.service";
import {Subscription} from "rxjs/Rx";
import {PlateErrorHandlerService} from "../../../shared/utils/plate-error-handler.service";
import {UIClientPlateItemComment, PlateItemCommentsService} from "../../../shared/api/plateitemcomments.service";
import {PlateAuthService, LoggedInUser} from "../../../../../shared/scripts/auth.service";
import {DatePickerService, CalendarChangeEmitObject} from "../../../shared/utils/semanticCalendar.component";
import {UsersService} from "../../../shared/api/users.service";
import {ClientUtil} from "../../../../../shared/scripts/util.service";
import {ConnectedAppsService} from "../../../shared/api/connectedapps.service";
import {ClientConnectedAppType} from "../../../shared/api/connectedapp.model";
import {Analytics} from "../../../../../shared/scripts/analytics.service";
import {PlatesService} from "../../../shared/api/plates.service";
import {SocketService} from "../../../shared/socket/socket.service";
import {ActivityService, UIClientActivity, ClientActivityActionType} from "../../../shared/api/activity.service";
import {BodyDropdownService} from "../../../shared/utils/bodyDropdown.directive";
import {TeamsService, UIClientTeamMember, UIClientTeam} from "../../../shared/api/teams.service";
import {PlatterService} from "../../../shared/api/platter.service";
import {FileUploader, ParsedResponseHeaders} from "ng2-file-upload/ng2-file-upload";
import {PlateToastService} from "../../../../../shared/scripts/directives/plate-toast.component.service";
import {PlateSideBarService} from "../../../+home/sidebar/sidebar.component";
import {UIClientPlate} from "../../../shared/api/plate.model";
import {HomePlateService} from "../../../+home/homeplate.service";

interface ICommentOrActivity {
    model: {
        id?: string,
        created?: number
    }
}

@Component({
    providers: [PlateItemCommentsService],
    moduleId: module.id,
    templateUrl: `/ps/app/+plates/native/item-edit/plate-item-edit.component.html`
})
export class PlateItemEditComponent implements OnInit {

    COMPONENT_ID = `PlateItemEditComponent_${ClientUtil.randomString()}`;
    private initStatus = {
        sidebarReady: false,
        waitingForSidebar: false,
        didInit: false
    }
    uploader: FileUploader = new FileUploader({});
    hasBaseDropZoneOver: boolean = false;

    user: LoggedInUser;
    routeSubscription: Subscription;

    viewingAttachment: ClientFileAttachment = null;
    uploadingFileAttachmentsPct: number = null;

    // Note that we should reference it as editingPlateItemService.getItem() for the most part
    // because of the dot problem. But in the HTML it is fine.
    editingItem: UIClientPlateItem;

    titleItemTextAreaWasInitialized = false;
    priorityColorClasses: string[] = [];

    private _comments: UIClientPlateItemComment[] = [];
    addingComment: UIClientPlateItemComment;
    editingComment: UIClientPlateItemComment;
    commentAreaFocused = false;

    private _activities: UIClientActivity[] = [];

    activitiesAndComments: any = [];

    editingTitle = false;
    editTitle = '';

    isReadOnly = false;

    team: UIClientTeam;
    assignees: UIClientTeamMember[] = [];

    currentTeamMemberFilter = '';

    @ViewChild('modal')
    modal: ElementRef;

    // At the time of writing, Angular 2 does not allowed template reference variables inside of ngIf's.
    // So we access with jQuery for now.
    //@ViewChild('saveLabel') saveLabel: ElementRef
    //@ViewChild('inputTextArea') inputTextArea: ElementRef;

    // getSaveLabel() { return $(this.modal.nativeElement).find(`[save-label]`) }
    getInputTextArea() { return $(this.modal.nativeElement).find(`[input-text-area]`) }
    getDueDateButton() { return $(this.modal.nativeElement).find(`[due-date-button]`) }
    getFileUploadInput() { return $(this.modal.nativeElement).find(`[plate-item-upload-input]`)}
    getDownloadIframe() { return $(this.modal.nativeElement).find(`[plate-item-dl-iframe]`)}
    getImageViewerWrapper() { return $('body').find(`[plate-image-viewer-wrapper]`) }

    constructor(
        private editingPlateItemService: EditingPlateItemService,
        private plateItemsService: PlateItemsService,
        private plateErrorHandler: PlateErrorHandlerService,
        private route: ActivatedRoute,
        private router: Router,
        private plateItemCommentsService: PlateItemCommentsService,
        private plateAuthService: PlateAuthService,
        private datePickerService: DatePickerService,
        private usersService: UsersService,
        private connectedAppsService: ConnectedAppsService,
        private platesService: PlatesService,
        private socketService: SocketService,
        private activityService: ActivityService,
        private bodyDropdownService: BodyDropdownService,
        private teamsService: TeamsService,
        private plattersService: PlatterService,
        private plateToastService: PlateToastService,
        private plateSideBarService: PlateSideBarService,
        private homePlateService: HomePlateService
    ) { }

    // ------------------------------------------------------------------- Lifecycle
    private commentsAndActivitiesReady() {
        let i = this._activities.length;
        if (i > 0) {
            while (i--) {
                let activity = this._activities[i];
                if (activity.model.activityActionType === ClientActivityActionType.CreateComment || activity.model.activityActionType === ClientActivityActionType.EditComment) {
                    this._activities.splice(i, 1);
                }
            }
        }
        this.activitiesAndComments = ClientUtil.combineArrays(this._comments, this._activities);
    }

    // ------------------------------------------------------------------- Init
    onSideBarReadyEvent(ready: boolean) {
        this.initStatus.sidebarReady = true;
        if (this.initStatus.waitingForSidebar && this.initStatus.sidebarReady) {
            this.doInit();
        }
    }
    private waitForSidebar() {
        this.initStatus.waitingForSidebar = true;
        if (this.initStatus.waitingForSidebar && this.initStatus.sidebarReady) {
            this.doInit();
        }
    }
    private doInit() {
        this.show();
        // this.initItemTitleTextArea();
        this.priorityColorClasses = this.plateItemsService.PRIORITY_COLOR_CLASSES;
        this.homePlateService.listenForPowerSearch(this);

        if (this.editingItem.model.id) {
            let gotComments = false;
            let gotActivities = false;
            this.plateItemCommentsService.get(this.editingItem.model.id).subscribe((comments) => {
                this._comments = this.plateItemCommentsService.cache;
                gotComments = true;
                if (gotComments && gotActivities) {
                    this.commentsAndActivitiesReady();
                }
            }, err => this.plateErrorHandler.error(err, 'in get comments in edit item'));
            this.plateItemsService.getActivities(this.editingItem.model.id).subscribe((activities) => {
            	this._activities = activities;
                gotActivities = true;
                if (gotComments && gotActivities) {
                    this.commentsAndActivitiesReady();
                }
            }, err => this.plateErrorHandler.error(err, 'in get activities for plate item edit'));

            let assignees = this.editingItem.model.assignees;
            let plate: UIClientPlate = this.platesService.getFromCache(this.editingItem.model.plate);
            this.editingPlateItemService.setColor(plate.model.color);
            let platter = this.plattersService.getFromCache(plate.model.platter);
            let platterTeam = platter.team;
            if (platterTeam) {
                this.team = platterTeam;
                for (let member of this.team.sortedMembers) {
                    // Deselect all members on load
                    member.selected = false;
                    if (this.editingItem.model.assignees.indexOf(member.model.id) > -1) {
                        // Select both the assignee copy and the team member for the dropdown
                        member.selected = true;
                        this.assignees.push(member);
                    }
                }
                this.isReadOnly = !platter.canModifyPlateItems(this.user);
            } else {
                this.team = this.teamsService.userPrivateTeam;
                let member = this.team.sortedMembers[0];
                // Deselect on load
                member.selected = false;
                if (this.editingItem.model.assignees.indexOf(this.user.id) > -1) {
                    // Select both the assignee copy and the team member for the dropdown
                    member.selected = true;
                    this.assignees.push(member);
                }
            }
        }

        this.editTitle = this.editingItem.model.title;
        this.setBlankAddingComment();
        this.setFileUploadHandler();
        this.setImageViewerWrapper();
        this.initStatus.didInit = true;
    }
    ngOnInit() {
        this.plateSideBarService.registerForSideBarReady(this);
        this.user = this.plateAuthService.getUserInfo();
        this.editingItem = this.editingPlateItemService.getItem();
        if (!this.editingItem) {
            // If there wasn't anything in the service, this page was navigated to
            // and we'll need to grab the item.
            // If the id was 'new', just forward to the main page
            this.routeSubscription = this.route.params.subscribe(params => {
                let id = params['id'];
                if (id === 'new') {
                    this.router.navigate(['']);
                } else {
                    this.plateItemsService.getById(id).subscribe(plateItem => {
                        // If we have the plate, grab its color.
                        // And if the plate is OPEN, grab the item model
                        let plate = this.platesService.getFromCache(plateItem.model.plate);
                        let color = 'gray';
                        if (plate) {
                            color = plate.model.color;
                            let plateComponent = this.platesService.getPlateComponentIfOpen(plate.model.id);
                            if (plateComponent) {
                                plateItem = plateComponent.getItemById(plateItem.model.id) || plateItem;
                            }
                        }
                        this.editingPlateItemService.setItem(<UIClientPlateItem>plateItem, color, 'Edit item', false);
                        this.editingItem = this.editingPlateItemService.getItem();
                        this.waitForSidebar();
                    }, err => {
                        // If the user doesn't have access we'll get an err down here
                        this.closeDialog();
                        this.onModalHidden();
                    });
                }
            });
        } else {
            this.waitForSidebar();
        }
    }

    ngOnDestroy() {
        this.homePlateService.unregisterForPowerSearch(this);
        if (this.routeSubscription) {
            this.routeSubscription.unsubscribe();
        }
        // Don't navigate because the only way this would be called is through navigation
        this.editingPlateItemService.unsetItem(false);
        this.plateSideBarService.unregisterForSideBarReady(this);
        this.hideDialog();
    }

    onDoPowerSearch(query: string) {
        this.manualFullHide();
    }

    // ------------------------------------------------------------------- Events

    // initItemTitleTextArea() {
    //     // The combination of a non-angular dialog and routing vs passing via service
    //     // on top of Angular not allowing template reference variables inside ngIf's
    //     // means that this initialization is a bit messy. Just check every Xms if
    //     // it's ready.
    //     let checkInterval = setInterval(() => {
    //         if (!this.titleItemTextAreaWasInitialized) {
    //             let inputTextAreaElement = this.getInputTextArea()[0];
    //             if (inputTextAreaElement) {
    //                 const eventStream = (<any>Observable).fromEvent(this.getInputTextArea()[0], 'keyup')
    //                     .map(() => {
    //                         this.getSaveLabel().css('opacity', 0);
    //                         return this.editingItem.model.title
    //                     })
    //                     .debounceTime(500)
    //                     .distinctUntilChanged();
    //                 eventStream.subscribe(input => {
    //                     this.plateItemsService.update(this.editingItem).subscribe((status) => {
    //                         this.getSaveLabel().css('opacity', 1);
    //                     }, error => this.plateErrorHandler.error(error, 'in plate item edit'));
    //                 });
    //                 this.titleItemTextAreaWasInitialized = true;
    //                 console.log('checking for text area');
    //                 window.clearInterval(<any>checkInterval);
    //             }
    //         }
    //     }, 70)
    // }

    onModalHidden() {
        this.getImageViewerWrapper().remove();
        $(this.modal.nativeElement).remove();
    }

    onModalStartHide() {
        this.viewingAttachment = null;
        this.editingPlateItemService.unsetItem(true);
        this.bodyDropdownService.hide();
        this.datePickerService.hide();
    }

    manualFullHide() {
        this.onModalStartHide();
        this.onModalHidden();
    }

    show() {
        console.log('show');
        let $modal = (<any>$(this.modal.nativeElement));
        if (typeof '$' && this.modal) {
            $modal
                .modal({
                    transition: 'fade up',
                    duration: 0,
                    autofocus: false,
                    //observeChanges: true, // <--- No good for our slightly complicated use case
                    onHide: () => {
                        this.onModalStartHide();
                    },
                    onHidden: () => {
                        this.onModalHidden();
                    },
                    onShow: () => {
                    }
                })
                .modal('show');
        }
    }

    hideDialog() {
        if (typeof '$' && this.modal) {
            (<any>$(this.modal.nativeElement))
                .modal({
                    transition: 'fade up',
                    duration: 200
                })
                .modal('hide');
        }
    }

    private setBlankAddingComment() {
        this.addingComment = new UIClientPlateItemComment({
            content: '',
            item: this.editingItem.model.id,
            ownerName: this.plateAuthService.getUserInfo().name
        });
    }

    private setFileUploadHandler() {
        // Set up the uploader
        let userMaxUploadSize = this.usersService.getMaxUploadSize(this.user, this.team);
        let bytesUploadedOnPlateItem = this.plateItemsService.getFileAttachmentsSize(this.editingItem);
        let sizeLeft = userMaxUploadSize - bytesUploadedOnPlateItem;
        this.uploader.setOptions({
            url: this.plateItemsService.getFileAttachmentUploadUrl(this.editingItem),
            authToken: this.plateAuthService.getAuthorizationHeader()
        });
        this.uploader.onProgressItem = (fileItem: any, progress: any) => {
            console.log('on progress item');
            console.log(fileItem);
            console.log(progress);
        }
        this.uploader.onProgressAll = (progress: any) => {
            console.log('on progress all');
            console.log(progress);
            this.uploadingFileAttachmentsPct = progress === 100 ? 99 : progress;
        }
        this.uploader.onSuccessItem = (item: any, response: string, status: number, headers: ParsedResponseHeaders) => {
            console.log('on success item');
            console.log(item, response, status, headers);
        }
        this.uploader.onErrorItem = (item: any, response: string, status: number, headers: ParsedResponseHeaders) => {
            console.log('on onErrorItem');
            console.log(item, response, status, headers);
        }
        this.uploader.onCompleteItem = (item: any, response: string, status: number, headers: ParsedResponseHeaders) => {
            console.log('on onCompleteItem');
            console.log(item, response, status, headers);
            if (response) {
                try {
                    let fileAttachments = JSON.parse(response);
                    if (fileAttachments && fileAttachments.length) {
                        for (let fileAttachment of fileAttachments) {
                            this.plateItemsService.addFileAttachmentForUi(this.editingItem, fileAttachment);
                        }
                    }
                } catch (e) {
                    console.log('unknown error retrieving uploaded file');
                }
            }
        }
        this.uploader.onWhenAddingFileFailed = (item: any, filter: any, options: any) => {
            console.log('on onWhenAddingFileFailed');
            console.log(item, filter, options);
        }
        this.uploader.onCancelItem = (item: any, response: string, status: number, headers: ParsedResponseHeaders) => {
            console.log('on onCancelItem');
            console.log(item, response, status, headers);
        }
        this.uploader.onCompleteAll = () => {
            console.log('on onCompleteAll');
            this.uploadingFileAttachmentsPct = null;
        }
        this.uploader.onAfterAddingAll = (fileItems: any[]) => {
            console.log('on after adding all');
            console.log(fileItems);
            let totalSize = 0;
            if (fileItems && fileItems.length) {
                for (let fileItem of fileItems) {
                    if (fileItem.file && fileItem.file.size) {
                        totalSize += fileItem.file.size;
                    }
                }
            }
            if (totalSize > sizeLeft) {
                console.log('size of files too big');
                this.uploader.clearQueue();
                this.plateToastService.toast({
                    title: 'Files too large',
                    message: `Plate Items have a ${userMaxUploadSize/1000/1000}mb upload limit. This item has ${ClientUtil.truncateDecimal(sizeLeft/1000/1000)} mb left.`,
                    timeout: 5000
                });
            } else {
                console.log('uploading');
                this.uploader.uploadAll();
                this.uploadingFileAttachmentsPct = 1;
            }
        }
    }

    private setImageViewerWrapper() {
        this.getImageViewerWrapper().appendTo('body');
    }

    // ------------------------------------------------------------------- UI Events

    private assignMetric(metricString: string, metricValue: string) {
        // For now just make the metric belong to the owner of the item
        let metric: ClientMetric = {
            name: metricString,
            owner: this.editingItem.model.owner,
            ownerType: MetricOwnerType.User,
            value: metricValue
        }
        let foundMetric: ClientMetric = null;
        for (let itemMetric of this.editingItem.model.metrics) {
            if (itemMetric.name === metricString) {
                foundMetric = itemMetric;
                break;
            }
        }
        if (foundMetric) {
            foundMetric.value = metricValue;
        } else {
            this.editingItem.model.metrics.push(metric);
        }
        this.plateItemsService.updateMetric(this.editingItem.model, metric).subscribe((status) => {
            // Do nothing
        }, err => this.plateErrorHandler.error(err, 'in save metric'));
    }
    assignPriorityClicked(metricValue: string) {
        this.editingItem.priorityValue = metricValue;
        let priorityString = this.plateItemsService.DEFAULT_METRIC_NAMES[0];
        this.assignMetric(priorityString, metricValue);
        Analytics.default('Priority Assigned', priorityString);
    }

    assignEffortClicked(metricValue: string) {
        this.editingItem.effortValue = metricValue;
        let effortString = this.plateItemsService.DEFAULT_METRIC_NAMES[1];
        this.assignMetric(effortString, metricValue);
        Analytics.default('Effort Assigned', effortString);
    }

    assignImpactClicked(metricValue: string) {
        this.editingItem.impactValue = metricValue;
        let impactString = this.plateItemsService.DEFAULT_METRIC_NAMES[2];
        this.assignMetric(impactString, metricValue);
        Analytics.default('Impact Assigned', impactString);
    }

    attachmentClicked(attachment: ClientFileAttachment) {
        if (ClientUtil.fileNameIsImage(attachment.fileName)) {
            this.viewingAttachment = attachment;
        } else {
            this.downloadAttachment(attachment);
        }
    }

    imageViewerWrapperCloseButtonClicked() {
        this.viewingAttachment = null;
    }

    deleteAttachmentClicked(attachment: ClientFileAttachment) {
        this.viewingAttachment = null;
        setTimeout(() => {
            this.plateItemsService.deleteFileAttachment(this.editingItem, attachment).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'get attachment download url'));
        }, 250);
    }

    private downloadAttachment(attachment: ClientFileAttachment) {
        const url = attachment.link;
        (<any>this.getDownloadIframe()[0]).src = url;
    }
    downloadFileAttachmentClicked(attachment: ClientFileAttachment) {
        this.downloadAttachment(attachment);
    }

    addCommentSaveClicked() {
        this.editingItem.model.numComments++;
        this.plateItemCommentsService.create(this.addingComment.model, this.editingItem.model.id).subscribe((uiComment) => {
            this.setBlankAddingComment();
            this.activitiesAndComments.push(uiComment);
        }, err => this.plateErrorHandler.error(err, 'in create comment edit item component'));
        Analytics.default('Comment Saved', 'addCommentSaveClicked()');
    }

    newCommentAreaFocused() {
        this.commentAreaFocused = true;
    }

    newCommentAreaBlurred() {
        this.commentAreaFocused = false;
    }

    private closeDialog() {
        // The onHide method of this dialog handles the navigation out
        (<any>$(this.modal.nativeElement))
            .modal('hide');
    }
    closeDialogClicked() {
        this.closeDialog();
    }

    private applyTitleEdit() {
        this.editingTitle = false;
        if (!this.isReadOnly) {
            if (this.editingItem.model.title !== this.editTitle) {
                this.editingItem.model.title = this.editTitle;
                this.plateItemsService.update(this.editingItem).subscribe((status) => {
                    // Do nothing
                }, error => this.plateErrorHandler.error(error, 'in plate item edit'));
            }
        }
    }
    titleEnterPressed($event) {
        $event && $event.preventDefault();
        this.getInputTextArea().blur();
        this.applyTitleEdit();
    }
    titleBlurred() {
        this.applyTitleEdit();
    }
    saveTitleEditClicked() {
        this.applyTitleEdit();
    }

    titleClicked() {
        this.editingTitle = true;
    }

    attachFileClicked() {
        this.getFileUploadInput().click();
    }

    connectedAppItemClicked($event: any, clientConnectedAppAttachment: ClientConnectedAppAttachment) {
        clientConnectedAppAttachment.expanded = !clientConnectedAppAttachment.expanded;
        if (clientConnectedAppAttachment.expanded) {
            console.log($event);
        }
        Analytics.default('Connected App Item Clicked Item Edit Component', 'connectedAppItemClicked()');
    }

    removeAttachmentClicked(clientConnectedAppAttachment: ClientConnectedAppAttachment) {
        let index = ClientUtil.getIndexById(clientConnectedAppAttachment.id, this.editingItem.model.connectedAppAttachments);
        this.editingItem.model.connectedAppAttachments.splice(index, 1);
        this.plateItemsService.deleteAttachment(this.editingItem, clientConnectedAppAttachment).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, 'in delete plate item attachment'));
        // Later, the attachment AND app attachment item will be the same thing
        // Owned by the plate item
        Analytics.default('Removed Connected App Item Clicked Item Edit Component', 'removeAttachmentClicked()');
    }

    removeDueDateClicked() {
        this.editingItem.model.due = null;
        this.plateItemsService.updateDueDate(this.editingItem.model, null).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, ''));
        Analytics.default('Removed Due Date Clicked', 'removeDueDateClicked()');
    }

    editCommentClicked(comment: UIClientPlateItemComment) {
        this.editingComment = new UIClientPlateItemComment({
            content: comment.model.content,
            item: '', // We're just gonna grab the comment.model.content
            ownerName: ''
        });
        comment.editing = true;
        Analytics.default('Edit Comment Clicked', 'editCommentClicked()');
    }

    deleteCommentConfirmClicked(comment: UIClientPlateItemComment) {
        comment.model.archived = true;
        this.plateItemCommentsService.delete(comment.model, this.editingItem.model.id, comment.model.id).subscribe((status) => {
            this.editingItem.model.numComments--;
        }, err => this.plateErrorHandler.error(err, 'in delete comment'));
        Analytics.default('Delete Comment Clicked', 'deleteCommentConfirmClicked()');
    }

    editCommentSaveClicked(commentToEdit: UIClientPlateItemComment) {
        if (commentToEdit.model.content === this.editingComment.model.content) {
            // Do nothing
        } else {
            commentToEdit.model.content = this.editingComment.model.content;
            commentToEdit.model.modified = Date.now(); // Kind of a cheat but not really
            this.plateItemCommentsService.update(commentToEdit.model, this.editingItem.model.id, commentToEdit.model.id).subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'in update comment'));
        }
        this.editingComment = null;
        commentToEdit.editing = false;
    }

    onDueDateChange(dateObject: CalendarChangeEmitObject) {
        if (dateObject && dateObject.date && dateObject.date.getTime) {
            let due = dateObject.date.getTime();
            this.editingItem.model.due = due;
            this.plateItemsService.updateDueDate(this.editingItem.model, due).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, ''));
            Analytics.default('Due Date Changed', 'onDueDateChange()');
        }
    }

    addDueDateClicked($event) {
        if (!this.isReadOnly) {
            if ($event) {
                let $target = $(event.target);
                if (!$target.closest('[due-delete-button]').length) {
                    this.datePickerService.listen(this.onDueDateChange.bind(this));
                    this.datePickerService.toggle(this.getDueDateButton()[0], this.editingItem.model.due);
                    Analytics.default('Due Date Add', 'addDueDateClicked()');
                }
            }
        }
    }

    teamMemberAssigneeClicked(member: UIClientTeamMember) {
        member.selected = !member.selected;
        if (member.selected) {
            this.assignees.push(member);
            this.plateItemsService.addAssignee(member, this.editingItem).subscribe((plateItem) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in add assignee'));
        } else {
            for (let i = 0; i < this.assignees.length; i++) {
                let assignee = this.assignees[i];
                if (assignee.model.id === member.model.id) {
                    this.assignees.splice(i, 1);
                    break;
                }
            }
            this.plateItemsService.removeAssignee(member.model.id, this.editingItem).subscribe((plateItem) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in remove assignee'));
        }
    }

    assigneesClicked($event) {
        if (!this.isReadOnly) {
            this.bodyDropdownService.clicked($event, {direction: 'left', relativeEl: '[item-edit-assignee-wrapper]', hideOnMenuClick: false})
        }
    }

    // ------------------------------------------------------------------- UI State

    private fileOverBaseTimeout = null;
    fileOverBase(over: boolean):void {
        clearTimeout(this.fileOverBaseTimeout);
        if (!over && this.hasBaseDropZoneOver) {
            this.fileOverBaseTimeout = setTimeout(() => {
                this.hasBaseDropZoneOver = false;
            }, 100);
        } else {
            this.hasBaseDropZoneOver = over;
        }
    }

    teamMemberIsFilteredOut(member: UIClientTeamMember) {
        // TODO - Needs debounce and optimization
        if (!this.currentTeamMemberFilter) {
            return false;
        }

        return member.model.name && member.model.name.toLowerCase().indexOf(this.currentTeamMemberFilter.toLowerCase()) === -1;
    }

    onTextAreaHeightChanged(height: number) {
        // Do nothing - yet
        // This is called for both the title box and comment box
    }

    userOwnsComment(comment: UIClientPlateItemComment) {
        return comment.model.owner === this.user.id;
    }

    getDetailStringForAppAttachment(detail: string, appAttachment: ClientConnectedAppAttachment, detailIndex: number) {
        switch (appAttachment.app) {
            case ClientConnectedAppType.Gmail:
                return detail;
            case ClientConnectedAppType.Slack:
                if (detailIndex === 0) {
                    return '#' + detail;
                }
                break;
        }
    }

}









