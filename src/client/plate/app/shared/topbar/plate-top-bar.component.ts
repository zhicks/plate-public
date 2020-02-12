import {OnInit, Component, ViewChild, ElementRef, EventEmitter} from "@angular/core";
import {Router} from "@angular/router";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {
    NotificationsService,
    UIClientNotification,
    ClientNotificationType,
    ClientNotification
} from "../api/notifications.service";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {Observable} from "rxjs/Rx";
import {PlateSearchService, SearchResult, SearchServiceCache, SearchServiceCacheObject} from "../api/search.service";
import {PlatesService} from "../api/plates.service";
import {ConnectedAppsService} from "../api/connectedapps.service";
import {EditingPlateItemService} from "../../+plates/native/item-edit/editing-plate-item.service";
import {UIClientPlateItem, PlateItemsService} from "../api/plateitems.service";
import {ClientConnectedAppType, UIClientConnectedApp} from "../api/connectedapp.model";
import {UIClientPlate} from "../api/plate.model";
import {HomePlateService} from "../../+home/homeplate.service";
import {PlateToastService} from "../../../../shared/scripts/directives/plate-toast.component.service";
import {UsersService} from "../api/users.service";
import {PlatterService} from "../api/platter.service";
import {SocketService} from "../socket/socket.service";
import {ActivityService} from "../api/activity.service";
import {PlateRightBarService} from "../../+rightbar/plate-right-bar.component";

enum SearchState {
    NotSearching,
    NoResults,
    Results
}

@Component({
    providers: [],
    selector: 'plate-top-bar',
    templateUrl: `ps/app/shared/topbar/plate-top-bar.component.html`
})
export class PlateTopBarComponent implements OnInit {

    constants = {
        defaultSearchResultCount: 5
    }

    @ViewChild('plateTopBar')
    plateTopBar: ElementRef;

    @ViewChild('searchBarInput')
    searchBarInput: ElementRef;

    @ViewChild('searchDropdownMenu')
    searchDropdownMenu: ElementRef;

    @ViewChild('feedbackButton')
    feedbackButton: ElementRef;

    feedbackHeartNotify = false;
    shouldRequestFeedback = false;
    feedbackFocus: EventEmitter<any> = new EventEmitter();
    feedbackRating: number = 0;
    feedbackMessage = '';

    ClientConnectedAppType = ClientConnectedAppType;

    user: LoggedInUser;
    unackedNotifications: UIClientNotification[] = [];
    ackedNotifications: UIClientNotification[] = [];

    SearchState = SearchState;
    searchQuery = '';
    searchState: SearchState = SearchState.NotSearching;
    searchResults: SearchServiceCache = {};

    hasUnseenNotifications = false;

    constructor(
        private plateAuthService: PlateAuthService,
        private router: Router,
        private notificationsService: NotificationsService,
        private plateErrorHandler: PlateErrorHandlerService,
        private searchService: PlateSearchService,
        private platesService: PlatesService,
        private connectedAppsService: ConnectedAppsService,
        private editingPlateItemService: EditingPlateItemService,
        private plateItemsService: PlateItemsService,
        private homePlateService: HomePlateService,
        private plateToastService: PlateToastService,
        private usersService: UsersService,
        private platterService: PlatterService,
        private socketService: SocketService,
        private plateRightBarService: PlateRightBarService,
        private activityService: ActivityService
    ) {}

    ngOnInit() {
        this.notificationsService.setNotificationListener(this);
        this.user = this.plateAuthService.getUserInfo();
        this.shouldRequestFeedback = this.user.requestFeedback;
        this.plateAuthService.listenForUserRefresh(this);
        // On load, we should ask for feedback.
        // If the user acknowledges the dropdown, this.requestFeedback is false
        // (Although the user token will still say requestFeedback until refreshed.)
        // On reload, the user token will be updated.

        this.notificationsService.get().subscribe((notifications) => {
            for (let notification of <UIClientNotification[]>notifications) {
                if (notification.model.live) {
                    this.unackedNotifications.push(notification);
                    if (!notification.model.seen) {
                        this.hasUnseenNotifications = true;
                    }
                } else {
                    this.ackedNotifications.push(notification);
                }
            }
        },
        error => this.plateErrorHandler.error(error, 'notifications service get'));

        this.initSearchArea();
        this.searchResults = this.searchService.cache;
    }

    ngAfterViewInit() {
        this.askUserForFeedbackIfWarranted(this.user);
    }

    onUserRefresh() {
        this.user = this.plateAuthService.getUserInfo();
        console.log('on user fresh');
        console.log(this.user);
        this.shouldRequestFeedback = this.feedbackHeartNotify = this.user.requestFeedback;
        for (let team of this.user.teams) {
            this.socketService.listenForTeamEvents({teamId: team.id});
        }
    }

    onNewNotification(clientNotification: ClientNotification) {
        this.hasUnseenNotifications = true;
        this.unackedNotifications.push(this.notificationsService.transformForUI(clientNotification));
    }

    /**
     * Check to see if we should ask the user for feedback and make the heart red if so.
      */
    private askUserForFeedbackIfWarranted(user: LoggedInUser) {
        if (this.shouldRequestFeedback) {
            setTimeout(() => {
                this.feedbackHeartNotify = true;
            }, 2000);
        }
    }

    // ------------------------------------------------------------------- UI Events
    notificationButtonClicked() {
        this.hasUnseenNotifications = false;
        for (let notification of this.unackedNotifications) {
            if (!notification.model.seen) {
                this.notificationsService.markSeen(notification).subscribe((status) => {
                	// Do nothing
                }, err => this.plateErrorHandler.error(err, 'in mark notification seen'));;
            }
        }
    }

    toggleActivityPaneClicked() {
        this.plateRightBarService.visible = !this.plateRightBarService.visible;
    }

    newTeamMemberClicked() {
        this.router.navigate(['/settings/team', { new: true }]);
    }

    newPlateClicked() {
        this.router.navigate(['/']);
        if (this.platterService.cache.length) {
            let platter = this.platterService.cache[0];
            this.homePlateService.emitNewPlateEvent(platter);
        } else {
            // Add a new platter
        }
    }

    feedbackButtonClicked() {
        setTimeout(() => {
            this.feedbackFocus.emit(null);
        }, 300);
        if (this.shouldRequestFeedback) {
            this.usersService.sendFeedback().subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'acknowledge feedback'));
            this.plateAuthService.refresh().subscribe(() => {
            	// do nothing
            }, err => this.plateErrorHandler.error(err, ''));
        }
        this.feedbackHeartNotify = false;
        this.shouldRequestFeedback = false;
    }

    sendFeedbackClicked() {
        if (this.feedbackMessage || this.feedbackRating) {
            (<any>$(this.feedbackButton.nativeElement)).dropdown('hide');
            this.plateToastService.toast({
                title: 'FEEDBACK SENT',
                message: 'Thank you!'
            });
            this.usersService.sendFeedback({
                message: this.feedbackMessage,
                rating: this.feedbackRating
            }).subscribe((status) => {
            	// Do nothing
            }, err => this.plateErrorHandler.error(err, 'in feedback send topbar'));
            this.feedbackMessage = '';
            // Don't clear the feedback rating
        }
    }

    onRatingClicked(value: number) {
        this.feedbackRating = value;
    }

    notificationClicked(notification: UIClientNotification, index: number) {
        if (notification.model.live) {
            this.notificationsService.acknowledge(notification).subscribe(
                null, // We don't need to do anything in this case
                error => this.plateErrorHandler.error(error, 'notification clicked')
            );
            this.unackedNotifications.splice(index, 1);
            this.ackedNotifications.unshift(notification);
        }

        if (notification.model.notificationType === ClientNotificationType.ItemDueSoon) {
            this.editingPlateItemService.setItemById(notification.model.itemId, 'Edit Item');
        } else { //if (notification.model.notificationType === ClientNotificationType.TeamInvite) { // Depracated default
                this.router.navigate(['/settings/team']);
        }
    }

    createPlateFromSearchResultsClicked() {
        let query = this.searchQuery;
        this.homePlateService.emitNewDynamicPlate(query, null);
    }

    seeAllSearchResultsClicked(searchObject: SearchServiceCacheObject) {
        let type = searchObject.type;
        let query = this.searchQuery;

    }

    // ------------------------------------------------------------------- Search UI State

    private executeSearchQuery() {
        let inputTextAreaElement = this.searchBarInput.nativeElement;
        if (this.searchQuery && this.searchQuery.length > 2) {
            $(inputTextAreaElement).parent().addClass('loading');
            this.searchService.search(this.searchQuery, this.user.id).subscribe(
                (results) => {
                    if (Object.keys(this.searchResults).length) {
                        this.searchState = SearchState.Results;
                    }
                },
                (error) => {
                    this.plateErrorHandler.error(error, 'search service search top bar')
                },
                () => {
                    // On complete
                    $(inputTextAreaElement).parent().removeClass('loading');
                    if (Object.keys(this.searchResults).length) {
                        this.searchState = SearchState.Results;
                    } else {
                        this.searchState = SearchState.NoResults;
                    }
                }
            );
        } else {
            this.searchService.clearSearch();
            this.searchState = SearchState.NotSearching;
        }
    }
    initSearchArea() {
        let inputTextAreaElement = this.searchBarInput.nativeElement;
        const eventStream = (<any>Observable).fromEvent(inputTextAreaElement, 'keyup')
            .map(() => {
                return this.searchQuery;
            })
            .debounceTime(500)
            .distinctUntilChanged();
        eventStream.subscribe(input => {
            this.executeSearchQuery();
        });
    }

    onSearchBarFocus() {
        if (!(<any>$(this.searchDropdownMenu.nativeElement)).transition('is visible')) {
            (<any>$(this.searchDropdownMenu.nativeElement)).transition({
                animation: 'slide down',
                duration: '100ms'
            });
        }
    }

    private closeSearchDropdownMenu() {
        if ((<any>$(this.searchDropdownMenu.nativeElement)).transition('is visible')) {
            (<any>$(this.searchDropdownMenu.nativeElement)).transition({
                animation: 'slide down',
                duration: '100ms'
            });
        }
    }
    onSearchBarBlur($event) {
        this.closeSearchDropdownMenu();
    }

    // ------------------------------------------------------------------- UI State


}














