import {PlateAuthService} from "../../../../shared/scripts/auth.service";
import {Injectable} from "@angular/core";
import {SlackApiChannelOrUserGroup, SlackApiMessageWithUserObj} from "../../../../../../typings/custom/slack/slack";
import {SlackPlateComponent} from "../../+plates/slack/slack-plate.component";
import {GmailPlateComponent} from "../../+plates/gmail/gmail-plate.component";
import {PlateComponent} from "../../+plates/native/plate.component";
import {PlateIntegrationSlackServiceStatic} from "../integrations/slack/plate-integration-slack.service";
import {ClientPlate} from "../api/plate.model";
import {ClientPlateItem} from "../api/plateitems.service";
import {ClientActivity} from "../api/activity.service";
import {ClientPlatter} from "../api/platter.service";
import {PlateSideBarComponent} from "../../+home/sidebar/sidebar.component";
import {ClientNotification} from "../api/notifications.service";
import {PlateIntegrationGmailUtility} from "../integrations/gmail/plate-integration-gmail.service";
import {PlateToastService} from "../../../../shared/scripts/directives/plate-toast.component.service";
import {HomePlateService} from "../../+home/homeplate.service";
import {ClientTeamMember} from "../api/teams.service";
import {ListPositionArrayIdAndPos} from "../../../../shared/scripts/util.service";
declare const io;

interface SocketListeners {
    slack: {
        [connectedAppId: string]: SlackPlateComponent
    },
    slackNewMessageWhileCached: {
        [connectedAppId: string]: SlackPlateComponent
    },
    gmail: {
        [connectedAppId: string]: GmailPlateComponent
    },
    teamPlate: {
        [plateId: string]: PlateComponent
    },
    teamEvent: {
        [globalTeamEventListener: string]: PlateSideBarComponent
    },
    user: {
        [globalUserEventListener: string]: PlateSideBarComponent
    }
}

@Injectable()
export class SocketService {

    private socketPromise: Promise<any>;
    private listeners: SocketListeners = {
        slack: {},
        slackNewMessageWhileCached: {},
        gmail: {},
        teamPlate: {},
        teamEvent: {},
        user: {}
    }
    private didInitialize = {
        slack: false,
        gmail: false,
        teamPlate: false,
        teamEvent: false,
        user: false
    }

    constructor(
        private plateAuthService: PlateAuthService,
        private plateToastService: PlateToastService,
        private homePlateService: HomePlateService
    ) {
        const socket = io();
        this.socketPromise = new Promise((resolve, reject) => {
            socket.on('authenticated', () => {
                console.log('authenticated');
                resolve(socket);
            });
            socket.on('unauthorized', (msg) => {
                console.log('unauthorized socket - msg: ');
                console.log(msg);
                reject(socket);
            });
            socket.on('connect', (msg: any) => {
                const token = this.plateAuthService.getToken();
                socket.emit('authenticate', {token: token})
            });
        });
    }

    // ------------------------------------------------------------------- USER EVENTS
    registerForUserEvents(app: PlateSideBarComponent) {
        this.listeners.user['globalUserEventListener'] = app;
    }
    listenForUserEvents(toServerMsg: { }) {
        this.socketPromise.then((socket) => {
            if (!this.didInitialize.user) {
                this.didInitialize.user = true;
                socket.on('activity created', (msg:{ from: ClientTeamMember, activity: ClientActivity }) => {
                    this.listeners.user['globalUserEventListener'] ? this.listeners.user['globalUserEventListener'].onNewActivity(msg) : null;
                });
                socket.on('new notification', (msg:{notification: ClientNotification}) => {
                    this.listeners.user['globalUserEventListener'] ? this.listeners.user['globalUserEventListener'].onNewNotification(msg) : null;
                });
                socket.on('new item from automation rule', (msg: {connectedApp: string, plateItem: ClientPlateItem}) => {
                    this.listeners.user['globalUserEventListener'] ? this.listeners.user['globalUserEventListener'].onNewItemFromAutomationRule(msg) : null;
                })
            }
            socket.emit('listen for user events', toServerMsg);
        }).catch((reason) => { });
    }

    // ------------------------------------------------------------------- TEAM EVENTS
    registerForTeamEvents(app: PlateSideBarComponent) {
        this.listeners.teamEvent['globalTeamEventListener'] = app;
    }
    private unregisterForTeamEvents(app: PlateSideBarComponent) { // Not used
        //delete this.listeners.teamEvent[app.base.model.id];
    }
    listenForTeamEvents(toServerMsg: { teamId: string }) {
        this.socketPromise.then((socket) => {
            if (!this.didInitialize.teamEvent) {
                this.didInitialize.teamEvent = true;
                socket.on('team plate added', (msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlateAdded(msg) : null;
                });
                socket.on('team plate archived', (msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlateArchived(msg) : null;
                });
                socket.on('team plate edited', (msg:{ from: ClientTeamMember, teamId: string, plate: ClientPlate }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlateEdited(msg) : null;
                });
                socket.on('team platter added', (msg:{ from: ClientTeamMember, teamId: string, platter: ClientPlatter }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterAdded(msg) : null;
                });
                socket.on('team platter edited', (msg:{ from: ClientTeamMember, teamId: string, platter: ClientPlatter }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterEdited(msg) : null;
                });
                // socket.on('team platter moved from team', (msg:{ from: User, platter: ClientPlatter, oldTeam: string }) => {
                //     this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterMoveFromTeam(msg) : null;
                // });
                // socket.on('team platter moved to team', (msg:{ from: User, platter: ClientPlatter, oldTeam: string }) => {
                //     this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterMoveToTeam(msg) : null;
                // });
                socket.on('team platter plates position', (msg:{ from: ClientTeamMember, teamId: string, platter: string, positions: ListPositionArrayIdAndPos[] }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterPlatesPosition(msg) : null;
                });
                socket.on('team platter plate move out', (msg:{ from: ClientTeamMember, plate: string, teamId: string, platter: string, positions: ListPositionArrayIdAndPos[] }) => {
                    this.listeners.teamEvent['globalTeamEventListener'] ? this.listeners.teamEvent['globalTeamEventListener'].onTeamPlatterPlatesMoveOut(msg) : null;
                });
            }
            socket.emit('listen for team events', toServerMsg);
        }).catch((reason) => { });
    }

    // ------------------------------------------------------------------- TEAM PLATE
    // Team Plate events - specific to Plate
    registerForTeamPlate(app: PlateComponent) {
        this.listeners.teamPlate[app.base.model.id] = app;
    }
    unregisterForTeamPlate(app: PlateComponent) {
        delete this.listeners.teamPlate[app.base.model.id];
    }
    listenForTeamPlateEvents(toServerMsg: { plateId: string }) {
        this.socketPromise.then((socket) => {
            if (!this.didInitialize.teamPlate) {
                this.didInitialize.teamPlate = true;
                socket.on('team plate item added', (msg:{from:ClientTeamMember, plateItem:ClientPlateItem }) => {
                    this.listeners.teamPlate[msg.plateItem.plate] ? this.listeners.teamPlate[msg.plateItem.plate].onTeamPlateItemAdded(msg) : null;
                });
                socket.on('team plate item position updated', (msg:{ from:ClientTeamMember, plateItem:ClientPlateItem, oldHeader: string }) => {
                    this.listeners.teamPlate[msg.plateItem.plate] ? this.listeners.teamPlate[msg.plateItem.plate].onTeamPlateItemPositionUpdated(msg) : null;
                });
                socket.on('team plate item edited', (msg:{ from:ClientTeamMember, plateItem:ClientPlateItem }) => {
                    this.listeners.teamPlate[msg.plateItem.plate] ? this.listeners.teamPlate[msg.plateItem.plate].onTeamPlateItemEdited(msg) : null;
                });
                socket.on('team plate item removed from plate', (msg:{ from:ClientTeamMember, plateItem:ClientPlateItem, oldPlate:string, oldHeader:string }) => {
                    this.listeners.teamPlate[msg.oldPlate] ? this.listeners.teamPlate[msg.oldPlate].onTeamPlateItemRemovedFromPlate(msg) : null;
                });
            }
            socket.emit('listen for team plate events', toServerMsg);
        }).catch((reason) => { });
    }

    // ------------------------------------------------------------------- SLACK
    registerForSlack(app: SlackPlateComponent) {
        this.listeners.slack[app.base.model.id] = app;
    }
    unregisterForSlack(app: SlackPlateComponent) {
        delete this.listeners.slack[app.base.model.id];
    }
    registerForSlackNewMessageWhileCached(app: SlackPlateComponent) {
        this.listeners.slackNewMessageWhileCached[app.base.model.id] = app;
    }
    listenForSlackEvents(toServerMsg: { connectedAppId: string }) {
        this.socketPromise.then((socket) => {
            if (!this.didInitialize.slack) {
                this.didInitialize.slack = true;
                socket.on('slack authenticated', (msg: { connectedAppId: string, connectedAppName:string }) => {
                    console.log('on slack authenticated');
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackAuthenticated(msg) : null;
                });
                socket.on('no slack for connected app', (msg: { connectedAppId: string }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onNoSlackForConnectedApp(msg) : null;
                });
                socket.on('slack message', (msg: { connectedAppId: string, message: SlackApiMessageWithUserObj }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackMessage(msg) : null;
                    if (!this.listeners.slack[msg.connectedAppId]) {
                        let app = this.listeners.slackNewMessageWhileCached[msg.connectedAppId];
                        if (app) {
                            PlateIntegrationSlackServiceStatic.newMessageForCache(msg.connectedAppId, msg.message);
                        }
                    }
                });
                socket.on('slack channels', (msg: { connectedAppId: string, channels: SlackApiChannelOrUserGroup[] }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackListChannels(msg) : null;
                });
                socket.on('slack socket ready', (msg: { connectedAppId: string }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackSocketReady(msg) : null;
                });
                socket.on('slack socket unable to start', (msg: { connectedAppId: string }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackSocketUnableToStart(msg) : null;
                });
                socket.on('slack messages for channel', (msg: { connectedAppId: string, messages: SlackApiMessageWithUserObj[] }) => {
                    this.listeners.slack[msg.connectedAppId] ? this.listeners.slack[msg.connectedAppId].onSlackGetMessagesForChannel(msg) : null;
                });
            }
            socket.emit('listen for slack events', toServerMsg);
        });
    }

    sendSlackListChannels(toServerMsg: { connectedAppId: string }) {
        this.socketPromise.then((socket) => {
            socket.emit('slack list channels', toServerMsg);
        });
    }

    sendGetMessagesForSlackChannel(toServerMsg: { connectedAppId: string, channelId: string, isPrivate: boolean }) {
        this.socketPromise.then((socket) => {
            socket.emit('slack list messages for channel', toServerMsg);
        });
    }

    sendMessageForSlackChannel(toServerMsg: {connectedAppId: string, channelId: string, message: string}) {
        this.socketPromise.then((socket) => {
            socket.emit('slack message for channel', toServerMsg);
        });
    }


    // ------------------------------------------------------------------- GMAIL
    registerForGmail(app: GmailPlateComponent) {
        this.listeners.gmail[app.base.model.id] = app;
    }
    unregisterForGmail(app: GmailPlateComponent) {
        delete this.listeners.gmail[app.base.model.id];
    }
    listenForGmailEvents(toServerMsg: { connectedAppId: string }) {
        this.socketPromise.then((socket) => {
            if (!this.didInitialize.gmail) {
                this.didInitialize.gmail = true;
                socket.on('gmail authenticated', (msg:{ connectedAppId:string, connectedAppName:string }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailAuthenticated(msg) : null;
                });
                socket.on('no gmail for connected app', (msg:{ connectedAppId:string }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onNoGmailForConnectedApp(msg) : null;
                });
                socket.on('gmail labels', (msg:{ connectedAppId:string, labels:gapi.client.gmail.Label[] }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailListLabels(msg) : null;
                });
                socket.on('gmail socket ready', (msg:{ connectedAppId:string }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailSocketReady(msg) : null;
                });
                socket.on('gmail socket unable to start', (msg:{ connectedAppId:string }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailSocketUnableToStart(msg) : null;
                });
                socket.on('gmail messages for label', (msg:{ connectedAppId:string, messages:gapi.client.gmail.Message[] }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailGetMessagesForLabel(msg) : null;
                });
                socket.on('gmail messages from watch', (msg:{ connectedAppId:string, messages:gapi.client.gmail.Message[] }) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailMessagesFromWatch(msg) : null;
                    if (msg && msg.messages && msg.messages.length) {
                        for (let message of msg.messages) {
                            let fromName = PlateIntegrationGmailUtility.getFromNameFromMessage(message);
                            let component: GmailPlateComponent = this.listeners.gmail[msg.connectedAppId];
                            let button: any = null;
                            if (component && !component.base.getSelected()) {
                                button = {
                                    text: 'Click to view',
                                    action: () => {
                                        component.base.select(true, true, this.homePlateService);
                                    }
                                }
                            }
                            this.plateToastService.toast({
                                title: `New Gmail`,
                                message: `From: ${fromName}`,
                                timeout: 6000,
                                button: button,
                                cssClass: 'small'
                                // No action yet - will require queueing up like the Search Service
                            });
                        }
                    }
                });
                socket.on('gmail email sent', (msg:{connectedAppId: string}) => {
                    this.listeners.gmail[msg.connectedAppId] ? this.listeners.gmail[msg.connectedAppId].onGmailEmailSent(msg) : null;
                });
            }
            socket.emit('listen for gmail events', toServerMsg);
        });
    }

    sendGmailListLabels(toServerMsg: { connectedAppId: string }) {
        this.socketPromise.then((socket) => {
            socket.emit('gmail list labels', toServerMsg);
        });
    }

    sendGetMessagesForGmailLabel(toServerMsg: { connectedAppId: string, labelName: string }) {
        this.socketPromise.then((socket) => {
            socket.emit('gmail list messages for label', toServerMsg);
        });
    }

    sendMessageReadForGmailMessage(toServerMsg: { connectedAppId: string, messageId: string }) {
        this.socketPromise.then((socket) => {
            socket.emit('gmail message mark as read', toServerMsg);
        });
    }

    sendGmailEmail(toServerMsg: {connectedAppId: string, raw: string, threadId: string}) {
        this.socketPromise.then((socket) => {
            socket.emit('gmail message send', toServerMsg);
        });
    }
}