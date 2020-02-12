import {Component, OnInit} from "@angular/core";
import {Http} from "@angular/http";
import {PlatesService, BuiltInColors} from "../../shared/api/plates.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {
    ConnectedAppsService, UIClientAutomationRule,
    ClientAutomationRuleAction, ClientAutomationRuleActionObject
} from "../../shared/api/connectedapps.service";
import {BasePlateComponent, ISearchableBasePlateComponent} from "../baseplate.component";
import {
    MessageUIExpansion,
    PlateIntegrationGmailUtility,
    ClientGmailLabel,
    ClientGmailMessage,
    PlateIntegrationGmailServiceStatic
} from "../../shared/integrations/gmail/plate-integration-gmail.service";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {PlateLocalStorageService} from "../../shared/utils/platelocalstorage.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {PlateDragDropService, IDraggableConnectedAppComponent} from "../plate-drag-drop.service";
import {PlateSanitizeService} from "../../shared/utils/plate-sanitize.service";
import {ConnectedAppItemsService} from "../../shared/api/connectedappitems.service";
import {SearchResult, PlateSearchService} from "../../shared/api/search.service";
import {UIClientGmailConnectedApp} from "../../shared/integrations/gmail/gmail-connected-app.model";
import {ClientConnectedAppType} from "../../shared/api/connectedapp.model";
import {SocketService} from "../../shared/socket/socket.service";
import {HomePlateService} from "../../+home/homeplate.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {UIClientPlate, IPlateHeader} from "../../shared/api/plate.model";
import {UIClientPlatter} from "../../shared/api/platter.service";
import {UIClientBasePlate} from "../../shared/api/baseplate.model";
import {PlateToastService} from "../../../../shared/scripts/directives/plate-toast.component.service";

enum GmailPlateMode {
    Default,
    IndividualEmail,
    Settings
}

@Component({
    providers: [ConnectedAppItemsService], // Each ConnectedApp Plate has this service as a provider - a new instance for each // , PlateIntegrationGmailServiceForPlate
    moduleId: module.id,
    selector: 'gmail-plate',
    templateUrl: `/ps/app/+plates/gmail/gmail-plate.component.html`
})
export class GmailPlateComponent extends BasePlateComponent<UIClientGmailConnectedApp> implements OnInit, IDraggableConnectedAppComponent<ClientGmailMessage>, ISearchableBasePlateComponent {

    COMPONENT_ID = `GmailPlate${ClientUtil.randomString()}`;

    private Constants = {
        Keys: {

        }
    }

    self = this;

    //openPlateTasks: UIClientConnectedAppItem[] = [];
    ClientConnectedAppType = ClientConnectedAppType;
    MessageUIExpansion = MessageUIExpansion;
    gmailLabels: ClientGmailLabel[] = [];
    gmailMessages: ClientGmailMessage[] = [];
    selectedLabel: ClientGmailLabel;
    GmailPlateMode = GmailPlateMode;
    mode: GmailPlateMode = GmailPlateMode.Default;
    editingPlateName = '';
    editingColor = false;
    colors = BuiltInColors;

    // Set from search result click - gmail goes into standalone mode
    individualEmail: ClientGmailMessage = null;

    private user: LoggedInUser;
    private gmailIsPopulated = false;
    private gmailAuthUrl = '';

    automationRules: UIClientAutomationRule[] = [];
    currentlyAddingAutomationRule: UIClientAutomationRule;
    waitingToSaveAutomationRule: boolean = false;
    noPlatesForAutomationRule: boolean = false;

    automationRuleWhenObjectOptions: string[] = [];
    automationRuleActionObjectOptions: ClientAutomationRuleActionObject[] = [];

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
        private socketService: SocketService,
        private homePlateService: HomePlateService,
        private plateToastService: PlateToastService
    ) {
        super(arguments);
    }

    ngOnInit() {
        this.automationRuleWhenObjectOptions = UIClientAutomationRule.gmailAutomationRuleWhenObjectOptions;
        this.automationRuleActionObjectOptions = UIClientAutomationRule.gmailAutomationRuleActionObjectOptions;
        this.plateDragDropService.register(ClientConnectedAppType.Gmail, this);
        this.searchService.registerForEvent(this);
        this.connectionState = this.ConnectionStates.Initializing;
        this.user = this.plateAuthService.getUserInfo();
        this.socketService.registerForGmail(this);
        this.socketService.listenForGmailEvents({ connectedAppId: this.base.model.id });
        this.homePlateService.listenForNewPlateEvent(this);
        this.homePlateService.listenForPlateArchived(this);
        this.gmailAuthUrl = this.connectedAppsService.getGmailAuthUrl(this.base, this.plateAuthService.getUserInfo().id);
        this.noPlatesForAutomationRule = !this.platesService.cache.length;
    }

    ngAfterViewInit() {

    }

    onClose() {
        this.searchService.unregisterForEvent(this);
        this.socketService.unregisterForGmail(this);
        this.homePlateService.unregisterForNewPlateEvent(this);
        this.homePlateService.unregisterForPlateArchived(this);
        PlateIntegrationGmailServiceStatic.setCacheFor(this, this.selectedLabel);
    }
    ngOnDestroy() {
        this.onClose();
    }

    // ------------------------------------------------------------------- Home Plate Events
    onNewPlateEvent(platter: UIClientPlatter) {
        this.noPlatesForAutomationRule = !this.platesService.cache.length;
    }
    onPlateArchived(plateToArchive: UIClientBasePlate) {
        this.noPlatesForAutomationRule = !this.platesService.cache.length;
    }

    // ------------------------------------------------------------------- Gmail Events

    onGmailAuthenticated(msg: { connectedAppId: string, connectedAppName: string }) {
        console.log('Gmail was authenticated');
        this.base.model.name = msg.connectedAppName;
    }

    onNoGmailForConnectedApp(msg: { connectedAppId: string }) {
        console.log('No gmail for this app');
        this.connectionState = this.ConnectionStates.NeedsConnection;
    }

    onGmailSocketReady(msg: { connectedAppId: string }) {
        console.log('GMAIL SOCKET IS READY');
        let cacheObj = PlateIntegrationGmailServiceStatic.getCacheFor(this);
        if (cacheObj) {
            this.gmailLabels = cacheObj.labels;
            this.selectedLabel = cacheObj.label;
            this.gmailMessages = cacheObj.messages;
            this.connectionState = this.ConnectionStates.Connected;
        } else {
            this.connectionState = this.ConnectionStates.Waiting;
            this.socketService.sendGmailListLabels({ connectedAppId: this.base.model.id });
        }
    }

    onGmailSocketUnableToStart(msg: { connectedAppId: string }) {
        console.log('GMAIL SOCKET UNABLE TO START');
        this.connectionState = this.ConnectionStates.NeedsConnection;
    }

    onGmailListLabels(msg: { connectedAppId: string, labels: gapi.client.gmail.Label[] }) {
        console.log('ON GMAIL LABELS');
        console.log(msg.labels);
        this.connectionState = this.ConnectionStates.Connected;
        ClientUtil.clearArray(this.gmailLabels);
        for (let i=0; i < msg.labels.length; i++) {
            let rawLabel = msg.labels[i];
            // Only put UI visible labels in
            if (rawLabel.labelListVisibility !== 'labelHide') {
                let label = {
                    model: rawLabel
                };
                this.gmailLabels.push(label);
                if (label.model.name === 'INBOX') {
                    this.selectedLabel = label;
                }
            }
        }
        if (!this.selectedLabel) {
            this.selectedLabel = this.gmailLabels[0];
        }
        this.changeLabel();
    }

    onGmailGetMessagesForLabel(msg: { connectedAppId: string, messages: gapi.client.gmail.Message[] }) {
        console.log('ON GMAIL GET MESSAGES FOR LABEL');
        ClientUtil.clearArray(this.gmailMessages);
        if (msg.messages) {
            for (let i=0; i < msg.messages.length; i++) {
                const rawMessage = msg.messages[i];
                let gmailMessage = PlateIntegrationGmailUtility.gmailRawToMessage(rawMessage);
                this.gmailMessages.push(gmailMessage);
                PlateIntegrationGmailServiceStatic.sortMessages(this.gmailMessages);
            }
        }
    }

    onGmailMessagesFromWatch(msg:{ connectedAppId:string, messages:gapi.client.gmail.Message[] }) {
        console.log('ON GMAIL MESSAGES FROM WATCH');
        if (msg.messages && this.selectedLabel && this.selectedLabel.model) {
            for (let i=0; i < msg.messages.length; i++) {
                const rawMessage = msg.messages[i];
                if (rawMessage.labelIds && rawMessage.labelIds.length) {
                    for (let labelId of rawMessage.labelIds) {
                        if (labelId === this.selectedLabel.model.id) {
                            let gmailMessage = PlateIntegrationGmailUtility.gmailRawToMessage(rawMessage);
                            this.gmailMessages.push(gmailMessage);
                            PlateIntegrationGmailServiceStatic.sortMessages(this.gmailMessages);
                        }
                    }
                }
            }
        }
    }

    onGmailEmailSent(msg:{ connectedAppId:string }) {
        this.plateToastService.toast({
            title: `${this.base.model.name}`,
            message: 'Your reply was sent.'
        })
    }

    // ------------------------------------------------------------------- Gmail lifecycle

    changeLabel() {
        if (this.selectedLabel) {
            this.socketService.sendGetMessagesForGmailLabel({connectedAppId: this.base.model.id, labelName: this.selectedLabel.model.id});
        }
    }

    newMessageAddedOnDom($message: JQuery) {
        // Note: Normally I wouldn't do direct jQuery on the controller like this
        // But Angular gave me crap about trying to use the ViewChild here
        // if (this.gmailIsPopulated) {
        //     let $gmailPlateContentWrapper = $('[gmail-plate-content-wrapper]');
        //     if ($gmailPlateContentWrapper && $gmailPlateContentWrapper.length) {
        //         let currentScrolltop = $gmailPlateContentWrapper.scrollTop();
        //         if (currentScrolltop !== 0) {
        //             $gmailPlateContentWrapper.scrollTop(
        //                 currentScrolltop + $message.outerHeight()
        //             )
        //         }
        //     }
        // }
    }

    getItemById(id: string): ClientGmailMessage {
        let messages = this.gmailMessages.filter(message => message.model.id === id);
        if (messages) {
            return messages[0];
        }
        return null;
    }

    // For drag and drop
    getItemContent(item: ClientGmailMessage) {
        return this.plateSanitizeService.sanitize(PlateIntegrationGmailUtility.getBody(item.model, true));
    }

    refreshOpenTasks() {
        // this.connectedAppItemsService.get(null, true, this.plateAuthService.getUserInfo().id, this.base.model.id).subscribe((connectedAppItems) => {
        //     this.openPlateTasks = <UIClientConnectedAppItem[]>connectedAppItems;
        //     console.log('open plate tasks');
        //     console.log(this.openPlateTasks);
        // }, error => this.plateErrorHandler.error(error, 'In refresh open tasks'));
    }

    // ------------------------------------------------------------------- Drag drop

    itemDragged(bagName: string, draggingEl: HTMLElement, fromBagEl: HTMLElement) {

    }

    // ------------------------------------------------------------------- Events from Message expanse

    sendReply(message: ClientGmailMessage, subject: string, content: string) {
        let email = '';

        let to = message.fromFull;
        /*
         The ID of the thread the message belongs to. To add a message or draft to a thread, the following criteria must be met:
         The requested threadId must be specified on the Message or Draft.Message you supply with your request.
         The References and In-Reply-To headers must be set in compliance with the RFC 2822 standard.
         The Subject headers must match.
         */
        let inReplyTo = message.inReplyTo;
        let references = message.references;
        let threadId = null;
        if (subject === message.subject && inReplyTo) {
            threadId = message.threadId;
        }

        let headersObj = {
            'To': to,
            'Subject': subject,
            'In-Reply-To': inReplyTo,
            'References': references
        }

        for(let header in headersObj)
            email += header += ": "+headersObj[header]+"\r\n";

        email += "\r\n" + content;
        const raw = window.btoa(email).replace(/\+/g, '-').replace(/\//g, '_');

        this.socketService.sendGmailEmail({
            connectedAppId: this.base.model.id,
            raw: raw,
            threadId: threadId
        })
    }

    // ------------------------------------------------------------------- Events from UI

    connectGmailAccountClicked() {
        window.open(this.gmailAuthUrl, '_blank');
    }

    gmailLabelClicked(label: ClientGmailLabel) {
        this.selectedLabel = label;
        this.changeLabel();
        Analytics.default('Gmail Label Clicked', label && label.model && label.model.name);
    }

    gmailUnexpandedMessageClicked(message: ClientGmailMessage) {
        if (message.expanded === this.MessageUIExpansion.NotExpanded) {
            for (let otherMessage of this.gmailMessages) {
                otherMessage.expanded = this.MessageUIExpansion.NotExpanded;
            }
            message.expanded = this.MessageUIExpansion.Expanding;
            if (message.unread) {
                message.unread = false;
                this.socketService.sendMessageReadForGmailMessage({connectedAppId: this.base.model.id, messageId: message.model.id});
            }
        }
        Analytics.default('Gmail Unexpand Clicked', 'gmailUnexpandedMessageClicked()');
    }

    // Settings
    leftArrowBackClicked() {
        this.mode = this.GmailPlateMode.Default;
        this.individualEmail = null;
    }
    plateSettingsIconClicked() {
        if (this.mode !== GmailPlateMode.Settings) {
            ClientUtil.clearArray(this.automationRules);
            for (let automationRule of this.base.model.automationRules) {
                let destPlate = this.platesService.getFromCache(automationRule.destPlate);
                if (destPlate) {
                    this.automationRules.push(new UIClientAutomationRule(destPlate, automationRule));
                }
            }
            this.editingPlateName = this.base.model.name;
            this.mode = GmailPlateMode.Settings;
        } else {
            this.mode = GmailPlateMode.Default;
        }
        Analytics.default('Gmail Plate Settings Clicked', 'plateSettingsIconClicked()');
    }
    // From settings
    private plateNameEdited() {
        if (this.base.model.name !== this.editingPlateName) {
            this.base.model.name = this.editingPlateName;
            this.base.model.nameIsCustom = true;
            this.base.model.overrideName = true;
            this.connectedAppsService.save(this.base, this.user.id).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'In save title from settings'));
        }
        Analytics.default('Gmail Plate Name Edited', 'plateNameEdited()');
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
            this.connectedAppsService.save(this.base, this.user.id).subscribe((status) => {
                // Do nothing
            }, err => this.plateErrorHandler.error(err, 'in save connected app'));
        }
        Analytics.default('Gmail Plate Color Edited', 'colorSelected()');
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
        this.connectedAppsService.save(this.base, this.user.id).subscribe((status) => {
            this.homePlateService.emitConnectedAppArchived(this.base);
            (<any>$(this.archiveConfirmDialog.nativeElement))
                .modal('hide');
        }, err => this.plateErrorHandler.error(err, 'in archive connected app'));
        Analytics.default('Gmail Archive Plate Clicked', 'archivedPlateClicked()');
    }
    nevermindArchivePlateClicked() {
        (<any>$(this.archiveConfirmDialog.nativeElement))
            .modal('hide');
    }

    plateSelectedForAutomationRuleClicked(plate: UIClientPlate) {
        this.currentlyAddingAutomationRule.model.destPlate = plate.model.id;
        this.currentlyAddingAutomationRule.destPlate = plate;
        let destHeader = plate.model.headers[0];
        this.currentlyAddingAutomationRule.destHeader = destHeader;
        this.currentlyAddingAutomationRule.model.destHeader = destHeader.id;
    }

    headerSelectedForAutomationRuleClicked(header: IPlateHeader) {
        this.currentlyAddingAutomationRule.destHeader = header;
        this.currentlyAddingAutomationRule.model.destHeader = header.id;
    }

    addAutomationRuleClicked() {
        let firstDestPlate = this.platesService.cache[0];
        let destHeader = firstDestPlate.model.headers[0];
        this.currentlyAddingAutomationRule = new UIClientAutomationRule(firstDestPlate, {
            destPlate: firstDestPlate.model.id,
            when: ['Subject'],
            contains: [''],
            action: ClientAutomationRuleAction.CreatePlateItem,
            connectedApp: this.base.model.id,
            creator: this.user.id,
            destHeader: destHeader.id
        })
    }

    saveAutomationRuleClicked() {
        if (this.currentlyAddingAutomationRule && !this.waitingToSaveAutomationRule) {
            if (this.currentlyAddingAutomationRule.model.contains && this.currentlyAddingAutomationRule.model.contains.length) {
                this.waitingToSaveAutomationRule = true;
                this.connectedAppsService.saveAutomationRule(this.user.id, this.base, this.currentlyAddingAutomationRule).subscribe((automationRule) => {
                    this.base.model.automationRules.push(automationRule.model);
                    this.automationRules.push(automationRule);
                    this.currentlyAddingAutomationRule = null;
                    this.waitingToSaveAutomationRule = false;
                }, err => this.plateErrorHandler.error(err, 'automation rule'));
            }
        }
    }

    automationRuleActionObjectClicked(actionObject: ClientAutomationRuleActionObject) {
        // TODO - Can just change the string here rather than evaluating in the ui with a method
        this.currentlyAddingAutomationRule.model.action = actionObject.action;
    }

    automationRuleWhenObjectClicked(whenString: string) {
        this.currentlyAddingAutomationRule.model.when[0] = whenString;
    }

    deleteAutomationRuleClicked(automationRule: UIClientAutomationRule) {
        for (let i = 0; i < this.automationRules.length; i++) {
            if (this.automationRules[i].model.id === automationRule.model.id) {
                this.automationRules.splice(i, 1);
                break;
            }
        }
        this.connectedAppsService.deleteAutomationRule(this.user.id, this.base, automationRule).subscribe((status) => {

        }, err => this.plateErrorHandler.error(err, 'in delete automation rule'));
    }

    // ------------------------------------------------------------------- Search event

    searchResultClicked(result: SearchResult) {
        if (this.base.isMinimized()) {
            this.base.minimize(false, true, this.homePlateService);
        }
        let gmailMessage: ClientGmailMessage = PlateIntegrationGmailUtility.gmailRawToMessage(result.model);
        this.individualEmail = gmailMessage;
        this.mode = this.GmailPlateMode.IndividualEmail;
        Analytics.default('Gmail Search Result Clicked', 'searchResultClicked()');
    }

    // ------------------------------------------------------------------- UI Status

    // TODO - Not optimized
    // But then again only used when adding automation rule
    getPlates() {
        let plates = [];
        for (let plate of this.platesService.cache) {
            if (plate.model.id && !plate.model.isDynamic) {
                plates.push(plate);
            }
        }
        return plates;
    }

    getAutomationActionStringFromEnum(action: ClientAutomationRuleAction) {
        for (let actionObject of this.automationRuleActionObjectOptions) {
            if (actionObject.action === action) {
                return actionObject.text;
            }
        }
    }

}
