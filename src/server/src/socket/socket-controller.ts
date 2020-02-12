import {PlateUserTokenDetails, User, IUser} from "../models/users";
import * as Q from "q";
import {ConnectedApp, IConnectedApp, ServerConnectedAppType} from "../models/connectedapps";
import {SlackClient} from "../integrations/slack/slack-client";
import {GmailClient} from "../integrations/slack/gmail-client";
import {Team} from "../models/teams";
import {Plate, IPlate, IPlatterPlatePosition} from "../models/plates";
import {IPlateItem, ISimplePlateItem} from "../models/plate-item";
import {IPlatter} from "../models/platters";
import {IActivity} from "../models/activity";
import {INotification} from "../models/notifications";

export interface PlateSocket extends SocketIO.Socket {
    decoded_token: PlateUserTokenDetails;

    // Note - team plates do not have clients as the data is sent
    // from our own server.
    slackClients: {[connectedAppId: string]: SlackClient};
    gmailClients: {[connectedAppId: string]: GmailClient};
    teamPlatesListeningTo: {[plateId: string]: string};
    teamsListeningTo: {[teamId: string]: string};
}

interface SocketListeners {
    slack: {
        [connectedAppId:string]: PlateSocket
    },
    gmail: {
        [connectedAppId:string]: PlateSocket
    },
    teamPlate: {
        [plateId:string]: {
            [socketId: string]: PlateSocket
        }
    },
    teamEvent: {
        [teamId:string]: {
            [socketId: string]: PlateSocket
        }
    },
    user: { // For user events when there is no team associated. Not reflected on the socket.
        [userId: string]: PlateSocket
    }
}

class SocketController {

    // Be careful putting variables up here
    // For memory leak and security purposes
    private socketIoServer: SocketIO.Server;
    private listeners: SocketListeners = {
        slack: {},
        gmail: {},
        teamEvent: {},
        teamPlate: {},
        user: {}
    }

    setSocketIoServer(socketIoServer: SocketIO.Server) {
        this.socketIoServer = socketIoServer;
    }

    private DO_LOG_DEBUG = false;
    private logListeners(location: string, plateSocket?: PlateSocket) {
        if (!this.DO_LOG_DEBUG) {
            return;
        }
        console.log(location);
        if (plateSocket) {
            if (plateSocket.slackClients) {
                console.log('slack clients for socket:');
                console.log(Object.keys(plateSocket.slackClients));
            }
            if (plateSocket.gmailClients) {
                console.log('gmail clients for socket:');
                console.log(Object.keys(plateSocket.gmailClients));
            }
            if (plateSocket.teamPlatesListeningTo) {
                console.log('team plates for socket:');
                console.log(Object.keys(plateSocket.teamPlatesListeningTo));
            }
            if (plateSocket.teamsListeningTo) {
                console.log('team events for socket:');
                console.log(Object.keys(plateSocket.teamsListeningTo));
            }
        }
        console.log('all slack listeners');
        console.log(Object.keys(this.listeners.slack));
        console.log('all gmail listeners');
        console.log(Object.keys(this.listeners.gmail));
        console.log('all team plate listeners');
        console.log(Object.keys(this.listeners.teamPlate));
        console.log('all team events listeners');
        console.log(Object.keys(this.listeners.teamEvent));
        console.log('all user events listeners');
        console.log(Object.keys(this.listeners.user));
    }

    // Called from within server.ts
    // A socket is made with every connection when it's needed.
    // (As in, a team plate or a connected app plate)
    // Every connected app will require a socket to exist, and team plates.
    // Only one socket per client.
    // The socket sends a request with the plate or connectedAppId with
    // every request - or in the case of team plates, the plate id.
    // When a socket wants to listen for events for a plate or connected app,
    // the socket joins a socket-io room for the id of that plate or connected app,
    // after verifying that they own that plate or connected app.
    newConnection(socket: SocketIO.Socket) {
        const plateSocket = <PlateSocket>socket;
        plateSocket.slackClients = {};
        plateSocket.gmailClients = {};
        plateSocket.teamPlatesListeningTo = {};
        plateSocket.teamsListeningTo = {};
        this.initializePlateSocket(plateSocket);
        this.logListeners('NEW CONNECTION', plateSocket);
    }

    private initializePlateSocket(plateSocket: PlateSocket) {
        plateSocket.on('disconnect', () => {
            // Delete class wide listeners
            for (let key in this.listeners.slack) {
                if (this.listeners.slack[key].id === plateSocket.id) {
                    delete this.listeners.slack[key];
                    break;
                }
            }
            for (let key in this.listeners.gmail) {
                if (this.listeners.gmail[key].id === plateSocket.id) {
                    delete this.listeners.gmail[key];
                    break;
                }
            }
            for (let key in plateSocket.teamPlatesListeningTo) {
                delete this.listeners.teamPlate[key][plateSocket.id];
                if (!Object.keys(this.listeners.teamPlate[key]).length) {
                    delete this.listeners.teamPlate[key];
                }
            }
            for (let key in plateSocket.teamsListeningTo) {
                delete this.listeners.teamEvent[key][plateSocket.id];
                if (!Object.keys(this.listeners.teamEvent[key]).length) {
                    delete this.listeners.teamEvent[key];
                }
            }

            delete this.listeners.user[plateSocket.decoded_token.id];

            // Do specific actions for socket clients
            for (let key in plateSocket.slackClients) {
                plateSocket.slackClients[key].stop();
            }

            for (let key in plateSocket.gmailClients) {
                plateSocket.gmailClients[key].stopWatch();
            }

            delete plateSocket.slackClients;
            delete plateSocket.gmailClients;
            delete plateSocket.teamPlatesListeningTo;
            delete plateSocket.teamsListeningTo;
            console.log('Disconnect. Number of sockets ' + Object.keys(this.socketIoServer.sockets.connected).length);
            this.logListeners('DISCONNECT', plateSocket);
        });

        // Team plate events from user - for a specific team plate
        plateSocket.on('listen for team plate events', msg => this.fromUserEventListenForTeamPlateEvents(plateSocket, msg));

        // Team events from user
        plateSocket.on('listen for team events', msg => this.fromUserEventListenForTeamEvents(plateSocket, msg));

        plateSocket.on('listen for user events', msg => this.fromUserEventListenForUserEvent(plateSocket, msg));
        plateSocket.on('acknowledge activity', msg => this.fromUserEventAcknowlegeActivity(plateSocket, msg));

        // Slack events from user
        plateSocket.on('listen for slack events', msg => this.fromUserEventListenForSlackEvents(plateSocket, msg));
        plateSocket.on('slack message for channel', msg => this.fromUserSlackMessageForChannel(plateSocket, msg));
        plateSocket.on('slack list channels', msg => this.fromUserEventListSlackChannels(plateSocket, msg));
        plateSocket.on('slack list messages for channel', msg => this.fromUserEventListSlackMessagesForChannel(plateSocket, msg));

        // Gmail events from user
        plateSocket.on('listen for gmail events', msg => this.fromUserEventListenForGmailEvents(plateSocket, msg));
        plateSocket.on('gmail list labels', msg => this.fromUserEventListGmailLabels(plateSocket, msg));
        plateSocket.on('gmail list messages for label', msg => this.fromUserEventListGmailMessagesForLabel(plateSocket, msg));
        plateSocket.on('gmail message mark as read', msg => this.fromUserMarkMessageAsRead(plateSocket, msg));
        plateSocket.on('gmail message send', msg => this.fromUserGmailMessageSend(plateSocket, msg))
    }

    // ------------------------------------------------------------------- FROM USER METHODS
    // These events come from the user. For "listen" events, we:
    //    - Check that the user attached to the socket (which was authed with JWT) exists
    //    - Check that the user has access to the claimed plate / connected app
    //    - Join the room for that plate or connected app.
    //    - For connected apps, place a client on the socket's [app]Clients object.
    // The only way a socket can have a connected app client (like SlackClient) is if
    // these steps have been met. So if user A has a Slack client and user B sends
    // 'listen for slack events' with A's connectedAppId, B still won't get anywhere
    // as A's socket is the only socket that has that slack client.

    // ------------------------------------------------------------------- Listeners

    fromUserEventListenForUserEvent(plateSocket: PlateSocket, msg: { }) {
        this.getUserFromSocketToken(plateSocket).then((user) => {
            this.listeners.user[user.id] = plateSocket;
        }).catch((reason) => {})
    }
    // For activity
    fromUserEventAcknowlegeActivity(plateSocket: PlateSocket, msg: { plateId: string }) {

    }

    // For a specific team plate
    fromUserEventListenForTeamPlateEvents(plateSocket: PlateSocket, msg: { plateId: string }) {
        if (!msg || !msg.plateId) {
            return;
        }
        const plateId = msg.plateId;
        this.getUserFromSocketToken(plateSocket).then((user) => {
            Plate.getByIdForUser(user, plateId).then((plate) => {
                if (plate) {
                    if (!this.listeners.teamPlate[plateId]) {
                        this.listeners.teamPlate[plateId] = {};
                    }
                    this.listeners.teamPlate[plateId][plateSocket.id] = plateSocket;
                    plateSocket.teamPlatesListeningTo[plateId] = plateId;
                    this.logListeners('LISTEN FOR TEAM PLATE', plateSocket);
                }
            }).catch((reason) => {})
        }).catch((reason) => {})
    }

    // For general, like a new team plate
    fromUserEventListenForTeamEvents(plateSocket: PlateSocket, msg: { teamId: string }) {
        if (!msg || !msg.teamId) {
            return;
        }
        const teamId = msg.teamId;
        this.getUserFromSocketToken(plateSocket).then((user) => {
            Team.getByIdForUser(teamId, user).then((team) => {
                if (team) {
                    if (!this.listeners.teamEvent[teamId]) {
                        this.listeners.teamEvent[teamId] = {};
                    }
                    this.listeners.teamEvent[teamId][plateSocket.id] = plateSocket;
                    plateSocket.teamsListeningTo[teamId] = teamId;
                    this.logListeners('LISTEN FOR TEAM', plateSocket);
                }
            }).catch((reason) => {})
        }).catch((reason) => {})
    }

    fromUserEventListenForSlackEvents(plateSocket: PlateSocket, msg: { connectedAppId: string }) {
        if (!msg || !msg.connectedAppId) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        this.getUserFromSocketToken(plateSocket).then((user) => {
            ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                if (connectedApp && connectedApp.type === ServerConnectedAppType.Slack) {
                    this.listeners.slack[connectedAppId] = plateSocket;
                    if (connectedApp._slack.accessToken) {
                        // If the connected app does NOT have an access token, the server will
                        // send one when the user attempts to auth. We cannot reach that point
                        // without having got to here first, so the socket listening for that
                        // event will exist.
                        // If we do have an access token, we send the same event as the server
                        // sends when the user attempts to auth.
                        this.serverEventSlackAuthenticatedForConnectedApp(connectedApp);
                    } else {
                        let payload = { connectedAppId: connectedAppId };
                        plateSocket.emit('no slack for connected app', payload);
                    }
                }
            }).catch((reason) => {})
        }).catch((reason) => {})
    }
    fromUserEventListenForGmailEvents(plateSocket: PlateSocket, msg: { connectedAppId: string }) {
        if (!msg || !msg.connectedAppId) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        this.getUserFromSocketToken(plateSocket).then((user) => {
            ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                if (connectedApp && connectedApp.type === ServerConnectedAppType.Gmail) {
                    this.listeners.gmail[connectedAppId] = plateSocket;
                    if (connectedApp._gmail.refreshToken) {
                        // See slack listen function for details
                        this.serverEventGmailAuthenticatedForConnectedApp(connectedApp);
                    } else {
                        let payload = { connectedAppId: connectedAppId };
                        plateSocket.emit('no gmail for connected app', payload);
                    }
                }
            }).catch((reason) => {})
        }).catch((reason) => {})
    }

    // ------------------------------------------------------------------- Slack Events
    fromUserEventListSlackChannels(plateSocket: PlateSocket, msg: { connectedAppId: string }) {
        if (!msg || !msg.connectedAppId) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        if (plateSocket.slackClients[connectedAppId]) {
            plateSocket.slackClients[connectedAppId].onListChannelsFromUser();
        }
        this.logListeners('LIST SLACK CHANNELS', plateSocket);
    }
    fromUserEventListSlackMessagesForChannel(plateSocket: PlateSocket, msg: { connectedAppId: string, channelId: string, isPrivate: boolean }) {
        // Note that this ALSO changes the default channel of the Slack plate
        if (!msg || !msg.connectedAppId || !msg.channelId) { // Don't check for isPrivate as it may not be there
            return;
        }
        const connectedAppId = msg.connectedAppId;
        const channelId = msg.channelId;
        const isPrivate = msg.isPrivate;
        if (plateSocket.slackClients[connectedAppId]) {
            plateSocket.slackClients[connectedAppId].onListMessagesForChannelFromUser(channelId, isPrivate);
        }
        let user = this.getUserFromSocketToken(plateSocket).then((user) => {
            ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                connectedApp.saveSlackDefaultChannel(channelId);
            });
        })
        this.logListeners('LIST SLACK MESSAGES FOR CHANNEL', plateSocket);
    }
    fromUserSlackMessageForChannel(plateSocket: PlateSocket, msg: {connectedAppId: string, channelId: string, message: string}) {
        if (!msg || !msg.connectedAppId || !msg.channelId || !msg.message) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        const channelId = msg.channelId;
        const message = msg.message;
        if (plateSocket.slackClients[connectedAppId]) {
            plateSocket.slackClients[connectedAppId].onMessageForChannelFromUser(channelId, message);
        }
        this.logListeners('SEND MESSAGE FOR SLACK CHANNEL', plateSocket);
    }

    // ------------------------------------------------------------------- Gmail Events
    fromUserEventListGmailLabels(plateSocket: PlateSocket, msg: { connectedAppId: string }) {
        if (!msg || !msg.connectedAppId) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        if (plateSocket.gmailClients[connectedAppId]) {
            plateSocket.gmailClients[connectedAppId].onListLabelsFromUser();
        }
        this.logListeners('LIST GMAIL LABELS', plateSocket);
    }

    fromUserEventListGmailMessagesForLabel(plateSocket: PlateSocket, msg: { connectedAppId: string, labelName: string }) {
        if (!msg || !msg.connectedAppId || !msg.labelName) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        const labelName = msg.labelName;
        if (plateSocket.gmailClients[connectedAppId]) {
            plateSocket.gmailClients[connectedAppId].onListMessagesForLabelFromUser(labelName);
        }
        this.logListeners('LIST MESSAGES FOR GMAIL LABEL', plateSocket);
    }

    fromUserMarkMessageAsRead(plateSocket: PlateSocket, msg: {connectedAppId: string, messageId: string}) {
        if (!msg || !msg.connectedAppId || !msg.messageId) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        const messageId = msg.messageId;
        if (plateSocket.gmailClients[connectedAppId]) {
            plateSocket.gmailClients[connectedAppId].onMarkMessageAsRead(messageId);
        }
        this.logListeners('MARK GMAIL MESSAGE AS READ', plateSocket);
    }

    fromUserGmailMessageSend(plateSocket: PlateSocket, msg: {connectedAppId: string, raw: string, threadId: string}) {
        if (!msg || !msg.connectedAppId || !msg.raw) {
            return;
        }
        const connectedAppId = msg.connectedAppId;
        if (plateSocket.gmailClients[connectedAppId]) {
            plateSocket.gmailClients[connectedAppId].onUserSendEmail(msg.raw, msg.threadId);
        }
    }

    // ------------------------------------------------------------------- SERVER EVENTS
    // These methods are initiated by the server and look for an existing socket in the listener identified
    // by the plate / connected app id (plus the prefix).
    // Sockets cannot exist in those listeners unless they have authed with JWT and authed with the plate /
    // connected app itself.

    private socketEventShouldGoToUser(socket: PlateSocket, specificMembers: string[]) {
        if (specificMembers && specificMembers.length) {
            if (specificMembers.indexOf(socket.decoded_token.id) > -1) {
                return true;
            }
            return false;
        }
        return true;
    }

    // ------------------------------------------------------------------- Activity events
    serverEventActivityCreated(user: IUser, activity: IActivity, specificMembers: string[]) {
        let payload= {from: user.simple(), activity: activity.simple()};
        if (activity.team) {
            let sockets = this.listeners.teamEvent[activity.team];
            if (sockets) {
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('activity created', payload);
                    }
                }
            }
            this.logListeners('ON ACTIVITY CREATED TEAM');
        } else {
            let userSocket = this.listeners.user[user.id];
            if (userSocket) {
                userSocket.emit('activity created', payload);
                this.logListeners('ON ACTIVITY CREATED', userSocket);
            }
        }
    }

    serverEventNewNotification(notification: INotification) {
        const userId = notification.userId;
        let userSocket = this.listeners.user[userId];
        if (userSocket) {
            let payload= {notification: notification.simple()};
            userSocket.emit('new notification', payload);
            this.logListeners('ON NEW NOTIFICATION', userSocket);
        }
    }

    serverEventNewItemFromAutomationRule(user: IUser, connectedApp: IConnectedApp, plateItem: ISimplePlateItem) {
        const userId = user.id;
        let userSocket = this.listeners.user[userId];
        if (userSocket) {
            let payload= {connectedApp: connectedApp.id, plateItem: plateItem};
            userSocket.emit('new item from automation rule', payload);
            this.logListeners('ON NEW ITEM FROM AUTOMATION RULE', userSocket);
        }
    }

    // ------------------------------------------------------------------- General team events
    serverEventTeamPlateAdded(user: IUser, platter: IPlatter, plate: IPlate) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), teamId: platter.team, plate: plate.simple() };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team plate added', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATE ADDED');
        }
    }
    serverEventTeamPlateEdited(user: IUser, platter: IPlatter, plate: IPlate) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), teamId: platter.team, plate: plate.simple() };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team plate edited', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATE EDITED');
        }
    }

    serverEventTeamPlatterAdded(user: IUser, platter: IPlatter) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), platter: platter.simple() };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter added', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATTER ADDED');
        }
    }
    serverEventTeamPlatterMovedToTeam(user: IUser, platter: IPlatter, oldTeam: string) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), platter: platter.simple(), oldTeam: oldTeam };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter moved to team', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATTER MOVED FROM OTHER TEAM');
        }
    }
    serverEventTeamPlatterMovedFromTeam(user: IUser, platter: IPlatter, oldTeam: string) {
        if (oldTeam) {
            let sockets = this.listeners.teamEvent[oldTeam];
            if (sockets) {
                let payload = { from: user.simple(), platter: platter.simple(), oldTeam: oldTeam };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter moved from team', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATTER MOVED FROM OTHER TEAM');
        }
    }
    serverEventTeamPlatterEdited(user: IUser, platter: IPlatter) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), platter: platter.simple() };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter edited', payload);
                    }
                }
            }
            this.logListeners('SERVER EVENT TEAM PLATTER EDITED');
        }
    }

    serverEventPlateListPositionUpdated(user: IUser, positions: IPlatterPlatePosition[], platter: IPlatter) {
        if (platter.team) {
            let sockets = this.listeners.teamEvent[platter.team];
            if (sockets) {
                let payload = { from: user.simple(), platter: platter.id, positions: positions, teamId: platter.team };
                let specificMembers = platter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter plates position', payload);
                    }
                }
            }
        }
    }

    serverEventPlateMovedPlatters(user: IUser, plate: IPlate, oldPlatter: IPlatter, oldPlatterPositions: IPlatterPlatePosition[]) {
        if (oldPlatter.team) {
            let sockets = this.listeners.teamEvent[oldPlatter.team];
            if (sockets) {
                let payload = { from: user.simple(), platter: oldPlatter.id, positions: oldPlatterPositions, teamId: oldPlatter.team, plate: plate.id };
                let specificMembers = oldPlatter.getSpecificMembersIfAny();
                for (let key in sockets) {
                    if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                        sockets[key].emit('team platter plate move out', payload);
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------- Team Plate Events - specific for plate
    serverEventTeamPlateItemAdded(user: IUser, plateItem: IPlateItem, platter: IPlatter) {
        let sockets = this.listeners.teamPlate[plateItem.plate];
        if (sockets) {
            let payload = { from: user.simple(), plateItem: plateItem.simple() };
            let specificMembers = platter.getSpecificMembersIfAny();
            for (let key in sockets) {
                if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                    sockets[key].emit('team plate item added', payload);
                }
            }
        }
        this.logListeners('SERVER EVENT TEAM PLATE ITEM ADDED');
    }

    serverEventTeamPlateItemPositionUpdated(user: IUser, plateItem: IPlateItem, oldHeader: string, platter: IPlatter) {
        let sockets = this.listeners.teamPlate[plateItem.plate];
        if (sockets) {
            let payload = { from: user.simple(), plateItem: plateItem.simple(), oldHeader: oldHeader };
            let specificMembers = platter.getSpecificMembersIfAny();
            for (let key in sockets) {
                if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                    sockets[key].emit('team plate item position updated', payload);
                }
            }
        }
    }

    serverEventTeamPlateItemRemovedFromPlate(user: IUser, plateItem: IPlateItem, oldHeader: string, oldPlate: string, platter: IPlatter) {
        let sockets = this.listeners.teamPlate[oldPlate];
        if (sockets) {
            let payload = { from: user.simple(), plateItem: plateItem.simple(), oldHeader: oldHeader, oldPlate: oldPlate };
            let specificMembers = platter.getSpecificMembersIfAny();
            for (let key in sockets) {
                if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                    sockets[key].emit('team plate item removed from plate', payload);
                }
            }
        }
    }

    serverEventTeamPlateItemEdited(user: IUser, plateItem: IPlateItem, platter: IPlatter) {
        let sockets = this.listeners.teamPlate[plateItem.plate];
        if (sockets) {
            let payload = { from: user.simple(), plateItem: plateItem.simple() };
            let specificMembers = platter.getSpecificMembersIfAny();
            for (let key in sockets) {
                if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                    sockets[key].emit('team plate item edited', payload);
                }
            }
        }
    }

    // ------------------------------------------------------------------- Slack Auth
    serverEventSlackAuthenticatedForConnectedApp(connectedApp: IConnectedApp) {
        // Called on the first initial auth and if the access token exists in Slack.
        // It's called authenticated but really it just mean "an access token exists" - it could be expired.
        const connectedAppId = connectedApp.id;
        const connectedAppName = connectedApp.name;
        let plateSocket = this.listeners.slack[connectedAppId];
        if (plateSocket) {
            let slackClient = plateSocket.slackClients[connectedAppId];
            if (!slackClient) {
                plateSocket.slackClients[connectedAppId] = new SlackClient(plateSocket, connectedAppId, connectedApp._slack.accessToken);
            } else {
                if (slackClient.hasBeenAuthenticated) {
                    slackClient.sendSocketReady();
                }
            }
            let payload = { connectedAppId: connectedAppId, connectedAppName: connectedAppName };
            plateSocket.emit('slack authenticated', payload);
        }
        this.logListeners('SLACK AUTHENTICATED', plateSocket);
    }

    // ------------------------------------------------------------------- Gmail Auth
    serverEventGmailAuthenticatedForConnectedApp(connectedApp: IConnectedApp) {
        // See serverEventSlackAuthenticatedForConnectedApp for details
        const connectedAppId = connectedApp.id;
        const connectedAppName = connectedApp.name;
        let plateSocket = this.listeners.gmail[connectedAppId];
        if (plateSocket) {
            let gmailClient = plateSocket.gmailClients[connectedAppId];
            if (!gmailClient) {
                plateSocket.gmailClients[connectedAppId] = new GmailClient(plateSocket, connectedApp, connectedApp._gmail.accessToken, connectedApp._gmail.refreshToken, connectedApp._gmail.accessTokenExpiration)
            } else {
                if (gmailClient.hasBeenAuthenticated) {
                    gmailClient.sendSocketReady();
                }
            }
            let payload = { connectedAppId: connectedAppId, connectedAppName: connectedAppName };
            plateSocket.emit('gmail authenticated', payload);
        }
        this.logListeners('GMAIL AUTHENTICATED', plateSocket);
    }

    // ------------------------------------------------------------------- Gmail Events
    getShouldSendGmailConnectedAppEvent(connectedApps: IConnectedApp[]) {
        if (connectedApps && connectedApps.length) {
            for (let connectedApp of connectedApps) {
                let relevantSocket = this.listeners.gmail[connectedApp.id];
                if (relevantSocket) {
                    return true;
                }
            }
        }
    }

    serverEventGmailNewMessagesFromWatch(connectedApps: IConnectedApp[], messages: gapi.client.gmail.Message[]) {
        if (connectedApps && connectedApps.length && messages && messages.length) {
            // Grab the sockets and call the gmail client to get the list
            let plateSockets: PlateSocket[] = [];
            let connectedAppIds: string[] = [];
            for (let connectedApp of connectedApps) {
                let connectedAppId = connectedApp.id;
                connectedAppIds.push(connectedAppId);
                let relevantSocket = this.listeners.gmail[connectedAppId];
                if (relevantSocket) {
                    plateSockets.push(relevantSocket);
                }
            }
            for (let socket of plateSockets) {
                if (socket.gmailClients) {
                    for (let key in socket.gmailClients) {
                        if (connectedAppIds.indexOf(key) > -1) {
                            socket.gmailClients[key].onNewMessagesFromWatch(messages);
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------- Archived
    serverEventTeamPlateArchived(user: IUser, plate: IPlate, platter: IPlatter) {
        // Delete all socket listeners for this Plate
        const plateId = plate.id;
        let sockets = this.listeners.teamPlate[plateId];
        for (let key in sockets) {
            delete sockets[key].teamPlatesListeningTo[plateId];
        }
        delete this.listeners.teamPlate[plateId];

        // Then let the sockets know
        sockets = this.listeners.teamEvent[platter.team];
        if (sockets) {
            let payload = { from: user.simple(), teamId: platter.team, plate: plate.simple() };
            let specificMembers = platter.getSpecificMembersIfAny();
            for (let key in sockets) {
                if (this.socketEventShouldGoToUser(sockets[key], specificMembers)) {
                    sockets[key].emit('team plate archived', payload);
                }
            }
        }
        this.logListeners('TEAM PLATE ARCHIVED');
    }

    serverEventConnectedAppArchived(connectedApp: IConnectedApp) {
        const connectedAppId = connectedApp.id;
        if (connectedApp.type === ServerConnectedAppType.Gmail) {
            let plateSocket = this.listeners.gmail[connectedAppId];
            if (plateSocket) {
                delete plateSocket.gmailClients[connectedAppId];
                delete this.listeners.gmail[connectedAppId];
            }
        } else if (connectedApp.type === ServerConnectedAppType.Slack) {
            let plateSocket = this.listeners.slack[connectedAppId];
            if (plateSocket) {
                delete plateSocket.slackClients[connectedAppId];
                delete this.listeners.slack[connectedAppId];
            }
        }
        this.logListeners('CONNECTED APP ARCHIVED');
    }

    // ------------------------------------------------------------------- Utility
    private getUserFromSocketToken(plateSocket: PlateSocket): Q.Promise<IUser> {
        let deferred = Q.defer<IUser>();
        let id = plateSocket.decoded_token.id;
        User.getById(id).then((user) => {
            if (!user) {
                deferred.reject(null);
            } else {
                deferred.resolve(user);
            }
        }).catch((reason) => deferred.reject(reason));
        return deferred.promise;
    }

}

export const socketController = new SocketController();










