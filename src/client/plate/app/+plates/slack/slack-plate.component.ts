import {Component, OnInit} from "@angular/core";
import {Http} from "@angular/http";
import {PlatesService, BuiltInColors} from "../../shared/api/plates.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {ConnectedAppsService} from "../../shared/api/connectedapps.service";
import {BasePlateComponent, ISearchableBasePlateComponent} from "../baseplate.component";
import {PlateAuthService} from "../../../../shared/scripts/auth.service";
import {PlateLocalStorageService} from "../../shared/utils/platelocalstorage.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {PlateDragDropService, IDraggableConnectedAppComponent} from "../plate-drag-drop.service";
import {PlateSanitizeService} from "../../shared/utils/plate-sanitize.service";
import {ConnectedAppItemsService} from "../../shared/api/connectedappitems.service";
import {SearchResult, PlateSearchService} from "../../shared/api/search.service";
import {ClientConnectedAppType} from "../../shared/api/connectedapp.model";
import {UIClientSlackConnectedApp} from "../../shared/integrations/slack/slack-connected-app.model";
import {
    PlateIntegrationSlackServiceForPlate,
    ClientSlackChannel,
    PlateIntegrationSlackServiceStatic, UIClientSlackPlateMessage
} from "../../shared/integrations/slack/plate-integration-slack.service";
import {SocketService} from "../../shared/socket/socket.service";
import {
    SlackApiChannelOrUserGroup,
    SlackApiMessageWithUserObj,
    SlackApiSearchMatch,
    SlackApiMessage
} from "../../../../../../typings/custom/slack/slack";
import {HomePlateService} from "../../+home/homeplate.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";

export interface SlackDragAndDropItemDetail {
    itemWithSubmessagesContent: string,
    channelName: string
}

enum SlackPlateMode {
    Default,
    Settings,
    SearchResult
}

@Component({
    providers: [PlateIntegrationSlackServiceForPlate],
    moduleId: module.id,
    selector: 'slack-plate',
    templateUrl: `/ps/app/+plates/slack/slack-plate.component.html`
})
export class SlackPlateComponent extends BasePlateComponent<UIClientSlackConnectedApp> implements OnInit, IDraggableConnectedAppComponent<UIClientSlackPlateMessage>, ISearchableBasePlateComponent {

    private Constants = {
        Keys: {

        }
    }

    private userId: string;
    ClientConnectedAppType = ClientConnectedAppType;

    slackChannels: ClientSlackChannel[] = [];
    slackMessages: UIClientSlackPlateMessage[] = [];
    selectedChannel: ClientSlackChannel;

    SlackPlateMode = SlackPlateMode;
    mode: SlackPlateMode = SlackPlateMode.Default;
    editingPlateName = '';
    editingColor = false;
    colors = BuiltInColors;

    currentlyScrolledToBottom = false;
    currentSlackMessage = '';

    searchMatch: SlackApiSearchMatch;
    slackMessagesHolderWhileShowingSearchMatch: UIClientSlackPlateMessage[] = [];
    private mostRecentMessageWasFromThisUser = false;
    private previousScrollPosition = 0;

    private slackAuthUrl = '';

    constructor(
        private plateLocalStorageService: PlateLocalStorageService,
        private platesService: PlatesService,
        private plateErrorHandler: PlateErrorHandlerService,
        private plateAuthService: PlateAuthService,
        private localStorageService: PlateLocalStorageService,
        private util: ClientUtil,
        private plateDragDropService: PlateDragDropService,
        private plateSanitizeService: PlateSanitizeService,
        private connectedAppItemsService: ConnectedAppItemsService,
        private searchService: PlateSearchService,
        private http: Http,
        private connectedAppsService: ConnectedAppsService,
        private slackIntegrationService: PlateIntegrationSlackServiceForPlate,
        private socketService: SocketService,
        private homePlateService: HomePlateService
    ) {
        super(arguments);
    }

    ngOnInit() {
        this.doInit();
    }
    private doInit() {
        this.plateDragDropService.register(ClientConnectedAppType.Slack, this);
        this.searchService.registerForEvent(this);
        this.connectionState = this.ConnectionStates.Initializing;
        this.userId = this.plateAuthService.getUserInfo().id;
        this.socketService.registerForSlack(this);
        this.socketService.listenForSlackEvents({ connectedAppId: this.base.model.id });
        this.slackAuthUrl = this.connectedAppsService.getSlackAuthUrl(this.base, this.plateAuthService.getUserInfo().id);
    }
    ngAfterViewInit() {
    }
    onClose() {
        this.searchService.unregisterForEvent(this);
        this.socketService.unregisterForSlack(this);
        if (this.connectionState === this.ConnectionStates.Connected && this.selectedChannel) {
            // TODO - This is a dumb way to do this
            PlateIntegrationSlackServiceStatic.setCacheFor(this, this.selectedChannel);
            this.socketService.registerForSlackNewMessageWhileCached(this);
        }
    }
    ngOnDestroy() {
        this.onClose();
    }

    // ------------------------------------------------------------------- Slack Events

    // If this connected app has been authed, this will be called by the server immediately.
    // If not, it will be called by the server AFTER explicit authorization
    // At this stage, the access token may have been revoked or something like that - it
    // hasn't been checked for yet.
    // The Slack socket is NOT technically ready to go yet - we have to wait for onSlackSocketReady
    // to make any requests.
    onSlackAuthenticated(msg: { connectedAppId: string, connectedAppName:string }) {
        console.log('Slack was authenticated');
        this.base.model.name = msg.connectedAppName;
    }

    onNoSlackForConnectedApp(msg: { connectedAppId: string }) {
        console.log('No slack for this app');
        this.connectionState = this.ConnectionStates.NeedsConnection;
    }

    private setScrollForMessageWrapper() {
        setTimeout(() => {
            let $slackPlateMessagesWrapper = $('#' + this.base.model.id).find('[slack-plate-messages-wrapper]');
            $slackPlateMessagesWrapper.off('scroll');
            $slackPlateMessagesWrapper.on('scroll', (e) => {
                // Angular 2 inexplicably will scroll the message wrapper to the top for just about any reason.
                // Hacky workaround checks to see if the scroll position is 0. We disable it by default.
                console.log('slack scroll');
                if (this.previousScrollPosition) {
                    if ($slackPlateMessagesWrapper.scrollTop() === 0) {
                        console.log('slack scroll was 0');
                        console.log('previous position was ' + this.previousScrollPosition);
                        $slackPlateMessagesWrapper.scrollTop(this.previousScrollPosition)
                    }
                }
                this.previousScrollPosition = $slackPlateMessagesWrapper.scrollTop();

                // We also listen to see if at bottom. If we are we scroll on new message.
                let el = $slackPlateMessagesWrapper[0];
                if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
                    this.currentlyScrolledToBottom = true;
                } else {
                    this.currentlyScrolledToBottom = false;
                }
            });
        }, 500);
    }

    onSlackSocketReady(msg: { connectedAppId: string }) {
        console.log('SLACK SOCKET IS READY');
        let cacheObj = PlateIntegrationSlackServiceStatic.getCacheFor(this);
        if (cacheObj) {
            this.slackChannels = cacheObj.channels;
            this.selectedChannel = cacheObj.channel;
            if (this.mode !== SlackPlateMode.SearchResult) {
                this.slackMessages = cacheObj.messages;
            } else {
                this.slackMessagesHolderWhileShowingSearchMatch = cacheObj.messages;
            }
            this.connectionState = this.ConnectionStates.Connected;
            this.setScrollForMessageWrapper();
        } else {
            this.connectionState = this.ConnectionStates.Waiting;
            this.socketService.sendSlackListChannels({ connectedAppId: this.base.model.id });
        }
    }

    onSlackSocketUnableToStart(msg: { connectedAppId: string }) {
        console.log('SLACK SOCKET UNABLE TO START');
        this.connectionState = this.ConnectionStates.NeedsConnection;
    }

    onSlackListChannels(msg: { connectedAppId: string, channels: SlackApiChannelOrUserGroup[] }, fromCacheSoDontRequestToServer?: boolean) {
        console.log('ON SLACK CHANNELS');
        console.log(msg.channels);
        this.connectionState = this.ConnectionStates.Connected;
        ClientUtil.clearArray(this.slackChannels);
        let defaultChannelId = this.base.model.slack.defaultChannel;
        for (let rawChannel of msg.channels) {
            let fullChannel = {
                model: rawChannel
            }
            this.slackChannels.push(fullChannel);
            if (rawChannel.id === defaultChannelId) {
                this.selectedChannel = fullChannel;
            }
        }
        if (!defaultChannelId) {
            this.selectedChannel = this.slackChannels[0];
        }
        if (!fromCacheSoDontRequestToServer) {
            this.changeChannel();
        }
        this.setScrollForMessageWrapper();
    }

    onSlackGetMessagesForChannel(msg: { connectedAppId: string, messages: SlackApiMessageWithUserObj[] }) {
        console.log('ON SLACK GET MESSAGES FOR CHANNEL');
        console.log(msg.messages);
        let slackMessageObj = this.slackMessages;
        if (this.mode === SlackPlateMode.SearchResult) {
            slackMessageObj = this.slackMessagesHolderWhileShowingSearchMatch;
        }
        ClientUtil.clearArray(slackMessageObj);
        if (msg.messages) {
            msg.messages.reverse();
            let previousSlackMessage: UIClientSlackPlateMessage = null;
            for (let i=0; i < msg.messages.length; i++) {
                const rawMessage = msg.messages[i];
                // If the previous message was the same user, make it a submessage
                let previousSlackMessageDate;
                let rawMessageDate;
                if (previousSlackMessage) {
                    rawMessageDate = PlateIntegrationSlackServiceStatic.getDateForSlackWeirdTimestamp(rawMessage.ts);
                    previousSlackMessageDate = PlateIntegrationSlackServiceStatic.getDateForSlackWeirdTimestamp(previousSlackMessage.model.ts);
                }
                if (previousSlackMessage && previousSlackMessage.model.userObj.id === rawMessage.userObj.id && ClientUtil.getDiffInMinutes(rawMessageDate, previousSlackMessageDate) < 10) {
                    previousSlackMessage.submessages.push(new UIClientSlackPlateMessage(rawMessage, null, null));
                } else {
                    let slackMessage = new UIClientSlackPlateMessage(rawMessage, [], PlateIntegrationSlackServiceStatic.getDomIdentifierForMessage(rawMessage));
                    slackMessageObj.push(slackMessage);
                    previousSlackMessage = slackMessage;
                }
            }
        }
        this.connectionState = this.ConnectionStates.Connected;
    }

    onSlackMessage(msg: {message: SlackApiMessageWithUserObj}) {
        console.log('ON SLACK MESSAGE');
        console.log(msg);
        this.mostRecentMessageWasFromThisUser = true;
        if (msg && msg.message && msg.message.channel === this.selectedChannel.model.id) {
            let previousSlackMessage: UIClientSlackPlateMessage = this.slackMessages[this.slackMessages.length];
            let slackMessage = PlateIntegrationSlackServiceStatic.getSlackMessageOrAddToPreviousForRaw(msg.message, previousSlackMessage);
            if (slackMessage) {
                this.slackMessages.push(slackMessage);
            }
        }
    }

    // ------------------------------------------------------------------- Slack Lifecycle

    changeChannel() {
        this.connectionState = this.ConnectionStates.Waiting;
        if (this.selectedChannel) {
            this.socketService.sendGetMessagesForSlackChannel({connectedAppId: this.base.model.id, channelId: this.selectedChannel.model.id, isPrivate: this.selectedChannel.model.isPrivate});
        }
    }

    // ------------------------------------------------------------------- Events from UI

    connectSlackClicked() {
        window.open(this.slackAuthUrl, '_blank');
    }

    slackChannelClicked(channel: ClientSlackChannel) {
        this.selectedChannel = channel;
        this.changeChannel();
        Analytics.default('Slack Change Channel', 'changeChannel()');
    }

    onEnterPressedForSlackMessage($event) {
        $event.preventDefault();
        const message = this.currentSlackMessage;
        this.currentSlackMessage = '';
        this.socketService.sendMessageForSlackChannel({connectedAppId: this.base.model.id, channelId: this.selectedChannel.model.id, message: message});
        Analytics.default('Slack Message Sent', 'onEnterPressedForSlackMessage()');
    }

    // Settings
    leftArrowBackClicked() {
        this.mode = this.SlackPlateMode.Default;
        if (this.slackMessagesHolderWhileShowingSearchMatch.length) {
            // Clicking on multiple search results should still retain the previous messages
            this.slackMessages = this.slackMessagesHolderWhileShowingSearchMatch;
            this.slackMessagesHolderWhileShowingSearchMatch = [];
        }
        this.searchMatch = null;
    }
    plateSettingsIconClicked() {
        if (this.mode !== SlackPlateMode.Settings) {
            this.editingPlateName = this.base.model.name;
            this.mode = SlackPlateMode.Settings;
        } else {
            this.mode = SlackPlateMode.Default;
        }
        Analytics.default('Slack Settings Clicked', 'plateSettingsIconClicked()');
    }
    private plateNameEdited() {
        if (this.base.model.name !== this.editingPlateName) {
            this.base.model.name = this.editingPlateName;
            this.base.model.nameIsCustom = true;
            this.base.model.overrideName = true;
            this.connectedAppsService.save(this.base, this.userId).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'In save title from settings'));
        }
        Analytics.default('Slack Name Change', 'plateNameEdited()');
    }
    plateNameEditEnterPressed() {
        this.plateNameEdited();
    }
    plateNameEditInputBlur() {
        this.plateNameEdited();
    }
    editColorClicked() {
        this.editingColor = true;
    }
    colorSelected(color: string) {
        this.editingColor = false;
        if (color !== this.base.model.color) {
            this.base.model.color = color;
            this.connectedAppsService.save(this.base, this.userId).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in save connected app'));
        }
        Analytics.default('Slack Color Change', 'colorSelected()');
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
    archivedPlateClicked() {
        this.base.model.archived = true;
        this.connectedAppsService.save(this.base, this.userId).subscribe((status) => {
            this.homePlateService.emitConnectedAppArchived(this.base);
            (<any>$(this.archiveConfirmDialog.nativeElement))
                .modal('hide');
        }, err => this.plateErrorHandler.error(err, 'in archive connected app'));
        Analytics.default('Slack Archived Plate', 'archivedPlateClicked()');
    }
    nevermindArchivePlateClicked() {
        (<any>$(this.archiveConfirmDialog.nativeElement))
            .modal('hide');
    }

    // ------------------------------------------------------------------- Search event

    searchResultClicked(result: SearchResult) {
        if (this.base.isMinimized()) {
            this.base.minimize(false, true, this.homePlateService);
        }
        if (!this.slackMessagesHolderWhileShowingSearchMatch.length) {
            // Clicking on multiple search results should still retain the previous messages
            this.slackMessagesHolderWhileShowingSearchMatch = this.slackMessages;
        }
        let match = <SlackApiSearchMatch>result.model;
        this.mode = this.SlackPlateMode.SearchResult;
        this.searchMatch = match;
        this.slackMessages = this.getMessagesFromSearchMatch(match);
        Analytics.default('Slack Search Result Clicked', 'searchResultClicked()');
    }

    private transformMatchMessageToClientSlackPlateMessage(message: SlackApiMessage): UIClientSlackPlateMessage {
        let messageWithUserObj = <SlackApiMessageWithUserObj>message;
        messageWithUserObj.userObj = {};
        return new UIClientSlackPlateMessage(messageWithUserObj, [], PlateIntegrationSlackServiceStatic.getDomIdentifierForMessage(messageWithUserObj));
    }
    private getMessagesFromSearchMatch(match: SlackApiSearchMatch): UIClientSlackPlateMessage[] {
        let message0: SlackApiMessage = match.previous_2;
        let message1: SlackApiMessage = match.previous;
        let message3: SlackApiMessage = match.next;
        let message4: SlackApiMessage = match.next_2;
        let message2: SlackApiMessage = {
            user: match.user,
            username: match.username,
            ts: match.ts,
            type: match.type,
            text: match.text
        };
        let ret: UIClientSlackPlateMessage[] = [];
        ret.push(this.transformMatchMessageToClientSlackPlateMessage(message0));
        ret.push(this.transformMatchMessageToClientSlackPlateMessage(message1));
        ret.push(this.transformMatchMessageToClientSlackPlateMessage(message2));
        ret.push(this.transformMatchMessageToClientSlackPlateMessage(message3));
        ret.push(this.transformMatchMessageToClientSlackPlateMessage(message4));
        return ret;
    }

    // ------------------------------------------------------------------- Drag and drop

    getItemById(ts: string): UIClientSlackPlateMessage {
        for (let item of this.slackMessages) {
            if (item.domId === ts) {
                return item;
            }
        }
    }

    getItemContent(item: UIClientSlackPlateMessage): SlackDragAndDropItemDetail {
        let itemFullContent = item.model.text;
        if (item.submessages && item.submessages.length) {
            for (let submessage of item.submessages) {
                itemFullContent += '\n' + submessage.model.text;
            }
        }
        let channelName = this.selectedChannel.model.name;
        return {
            itemWithSubmessagesContent: itemFullContent,
            channelName: channelName
        };
    }

    refreshOpenTasks() {
        // Do nothing for now
    }

    // ------------------------------------------------------------------- UI State

    newMessageAddedOnDom($message: JQuery) {
        this.scrollToBottom(this.mostRecentMessageWasFromThisUser || this.currentlyScrolledToBottom);
        console.log('MESSAGE ADDED ON DOM');
        this.mostRecentMessageWasFromThisUser = false;
    }

    // ------------------------------------------------------------------- Utility
    scrollToBottom(force: boolean) {
        // Note: Normally I wouldn't do direct jQuery on the controller like this
        // But Angular gave me crap about trying to use the ViewChild here
        let $slackPlateMessagesWrapper = $('#' + this.base.model.id).find('[slack-plate-messages-wrapper]');
        if ($slackPlateMessagesWrapper && $slackPlateMessagesWrapper.length) {
            if (force || $slackPlateMessagesWrapper.scrollTop() + $slackPlateMessagesWrapper[0].clientHeight >= $slackPlateMessagesWrapper[0].scrollHeight) {
                // We are at the bottom (for the time being)
                $slackPlateMessagesWrapper.scrollTop($slackPlateMessagesWrapper[0].scrollHeight);
                this.currentlyScrolledToBottom = true;
                this.previousScrollPosition = $slackPlateMessagesWrapper[0].scrollHeight;
            }
        }
    }

}
