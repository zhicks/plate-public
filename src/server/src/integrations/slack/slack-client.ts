// Some references:
// https://github.com/slackhq/node-slack-sdk/blob/master/lib/clients/web/facets/channels.js
// https://api.slack.com/methods

import * as Q from "q";
import {
    SlackApiMessage, SlackApiChannelOrUserGroup, SlackApiMessageWithUserObj,
    SlackApiUser, SimplifiedSlackUserObject, SlackApiSearchMatch
} from "../../../../../typings/custom/slack/slack";
import {
    IConnectedApp, SearchResultOptions, SearchResultNoIcon,
    ServerConnectedAppType, SearchResultsWithSize
} from "../../models/connectedapps";
//noinspection TypeScriptUnresolvedVariable
const RtmClient = require('@slack/client').RtmClient;
//noinspection TypeScriptUnresolvedVariable
const RTM_EVENTS: RtmEvents = require('@slack/client').RTM_EVENTS;
//noinspection TypeScriptUnresolvedVariable
const CLIENT_EVENTS: ClientEvents = require('@slack/client').CLIENT_EVENTS;
//noinspection TypeScriptUnresolvedVariable
const WebClient = require('@slack/client').WebClient;
//noinspection TypeScriptUnresolvedVariable
const MemoryDataStore = require('@slack/client').MemoryDataStore;

// Custom interfaces since there are no typings
// Note that these are incomplete - adding as we go
interface RtmEvents {
    MESSAGE: string;
    REACTION_ADDED: string;
    REACTION_REMOVED: string;
}
interface ClientEvents {
    RTM: {
        AUTHENTICATED: string;
        UNABLE_TO_RTM_START: string;
    }
}
interface IRtmClient {
    start: Function;
    on(event: string, callback: Function);
    disconnect: Function;
    dataStore: {
        getTeamById: Function,
        getUserById: Function
    }
    sendMessage: Function; // Note that this does not send an event to the user itself
}
interface IWebClient {
    channels: {
        history: Function,
        list: Function
    },
    groups: {
        history: Function,
        list: Function
    },
    search: {
        messages: Function
    }
    auth: {
        test: Function
    }
}

interface SlackUserInfo {
    team: string;
    user: string;
    team_id: string;
    user_id: string;
}

export class SlackClient {

    private rtm: IRtmClient;
    private webClient: IWebClient;
    private connectedAppId: string;
    private clientSocket: SocketIO.Socket;

    hasBeenAuthenticated = false;

    constructor(clientSocket: SocketIO.Socket, connectedAppId: string, token: string) {
        this.webClient = new WebClient(token);
        this.clientSocket = clientSocket;
        this.connectedAppId = connectedAppId;
        this.rtm = new RtmClient(token, {
            logLevel: 'error',
            dataStore: new MemoryDataStore()
        });
        this.rtm.start();

        // Events from Slack
        this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, this.onAuthenticatedFromSlack.bind(this));
        this.rtm.on(CLIENT_EVENTS.RTM.UNABLE_TO_RTM_START, this.onUnableToStart.bind(this));
        this.rtm.on(RTM_EVENTS.MESSAGE, this.onMessageFromSlack.bind(this));
    }

    stop() {
        this.rtm.disconnect();
    }

    // ------------------------------------------------------------------- Events from the User
    onMessageForChannelFromUser(channelId: string, message: string) {
        this.rtm.sendMessage(message, channelId, (err, msg) => {
            if (err) {
                console.error(err);
            } else {
                this.onMessageFromSlack(msg);
            }
        });
    }

    onListChannelsFromUser() {
        Q.all([this.listChannels(), this.listPrivateChannels()]).then((channelArrays) => {
            let channels = [];
            for (let channelArray of channelArrays) {
                for (let channel of channelArray) {
                    channels.push(channel);
                }
            }
            this.clientSocket.emit('slack channels', { connectedAppId: this.connectedAppId, channels: channels });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    onListMessagesForChannelFromUser(channelId: string, isPrivate: boolean) {
        this.listMessagesForChannel(channelId, isPrivate).then((messages) => {
            for (let message of messages) {
                message.channel = channelId;
            }
            this.clientSocket.emit('slack messages for channel', { connectedAppId: this.connectedAppId, messages: messages });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    // ------------------------------------------------------------------- Events from Slack
    sendSocketReady() {
        this.clientSocket.emit('slack socket ready', { connectedAppId: this.connectedAppId });
    }
    private onAuthenticatedFromSlack() {
        this.hasBeenAuthenticated = true;
        this.sendSocketReady();
    }
    private onUnableToStart () {
        // We will test this to see how reliable it is after just one go
        this.clientSocket.emit('slack socket unable to start', { connectedAppId: this.connectedAppId })
    }
    private onMessageFromSlack(message: SlackApiMessage) {
        let messageObj: SlackApiMessageWithUserObj = <SlackApiMessageWithUserObj>message;
        let user: SlackApiUser = this.rtm.dataStore.getUserById(message.user);
        // Note that on this call, channel ID is included, but in listMessagesForChannel, it is not.
        if (user) {
            messageObj.userObj = {
                id: user.id,
                name: user.name,
                image_32: user.profile.image_32
            }
        } else {
            messageObj.userObj = {};
        }

        this.clientSocket.emit('slack message', { connectedAppId: this.connectedAppId, message: message });
    }

    // ------------------------------------------------------------------- Utility
    /**
     * Returns public channels.
     * Just gets the ones that the user is in.
     * @returns {Promise<SlackApiChannelOrUserGroup[]>}
     */
    private listChannels(): Q.Promise<SlackApiChannelOrUserGroup[]> {
        let deferred = Q.defer<SlackApiChannelOrUserGroup[]>();
        this.webClient.channels.list({
            exclude_archived: 1
        }, (err, channelsObj) => {
            if (err) {
                deferred.reject(err);
            } else {
                let channels = channelsObj.channels;
                if (!channels) {
                    deferred.resolve([]);
                } else {
                    deferred.resolve(channels.filter(channel => channel.is_member));
                }
            }
        });
        return deferred.promise;
    }

    /**
     * Private channels are technically user groups and lack "is_member" adn "num_members".
     * @returns {Promise<SlackApiChannelOrUserGroup[]>}
     */
    private listPrivateChannels(): Q.Promise<SlackApiChannelOrUserGroup[]> {
        let deferred = Q.defer<SlackApiChannelOrUserGroup[]>();
        this.webClient.groups.list({
            exclude_archived: 1
        }, (err, channelsObj) => {
            if (err) {
                deferred.reject(err);
            } else {
                let groups = channelsObj.groups;
                if (!groups) {
                    deferred.resolve([]);
                } else {
                    for (let group of groups) {
                        group.isPrivate = true;
                    }
                    deferred.resolve(groups);
                }
            }
        });
        return deferred.promise;
    }
    private listMessagesForChannel(channelId: string, isPrivate: boolean): Q.Promise<SlackApiMessageWithUserObj[]> {
        let deferred = Q.defer<SlackApiMessageWithUserObj[]>();
        let clientObj = this.webClient.channels;
        if (isPrivate) {
            clientObj = this.webClient.groups;
        }
        clientObj.history(channelId, {
            count: 30
        }, (err, messagesObj) => {
            if (err) {
                deferred.reject(err);
            } else {
                let messages = messagesObj.messages;
                for (let message of messages) {
                    let user: SlackApiUser = this.rtm.dataStore.getUserById(message.user);
                    if (user) {
                        // Certain users won't have an ID
                        message.userObj = <SimplifiedSlackUserObject>{
                            id: user.id,
                            name: user.name,
                            image_32: user.profile.image_32
                        };
                    } else {
                        message.userObj = {};
                    }
                }
                deferred.resolve(messages);
            }
        });
        return deferred.promise;
    }
}

export class SlackClientStatic {

    static search(connectedApp: IConnectedApp, query: string, options: SearchResultOptions): Q.Promise<SearchResultsWithSize> {
        // https://api.slack.com/methods/search.messages
        let deferred = Q.defer<SearchResultsWithSize>();
        const accessToken = connectedApp._slack.accessToken;
        const webClient: IWebClient = new WebClient(accessToken);
        const team = connectedApp.slack.teamName;

        let slackOptions: any = {}
        slackOptions.count = options.maxResults;

        webClient.search.messages(query, slackOptions, (err, messagesObj) => {
            if (err) {
                deferred.reject(err);
            } else {
                let searchResults: SearchResultNoIcon[] = [];
                let resultObj = messagesObj.messages;
                let resultSizeEstimate = resultObj.total;
                //noinspection TypeScriptUnresolvedVariable
                let matches: SlackApiSearchMatch[] = resultObj.matches;
                if (matches && matches.length) {
                    for (let match of matches) {
                        searchResults.push({
                            id: match.ts,
                            basePlateInstanceId: connectedApp.id,
                            type: ServerConnectedAppType.Slack,
                            model: match,
                            iconFileType: 'png',
                            title: match.channel.name,
                            detailOne: team,
                            detailTwo: match.username,
                            snippet: match.text,
                            timestamp: +SlackClientStatic.getDateForSlackWeirdTimestamp(match.ts)
                        });
                    }
                }
                deferred.resolve({
                    searchResultsNoIcon: searchResults,
                    resultSizeEstimate: resultSizeEstimate
                });
            }
        })
        return deferred.promise;
    }

    static getUserInfo(accessToken: string): Q.Promise<SlackUserInfo> {
        let deferred = Q.defer<SlackUserInfo>();
        const webClient: IWebClient = new WebClient(accessToken);
        webClient.auth.test((err, info) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(info);
            }
        })
        return deferred.promise;
    }

    static getDateForSlackWeirdTimestamp(messageTsString: string) {
        let stringValue = messageTsString;
        stringValue = stringValue.replace('.', '');
        return new Date(+stringValue.substring(0, stringValue.length - 3));
    }

}
