import * as mongoose from "mongoose";
import * as Q from "q";
import {IUser, User} from "./users";
import {GmailClientStatic, PlateIntegrationServerGmailUtility} from "../integrations/slack/gmail-client";
import {SlackClientStatic} from "../integrations/slack/slack-client";
import {socketController} from "../socket/socket-controller";
import {Plate, IPlate} from "./plates";
import {IConnectedAppAttachment, PlateItem} from "./plate-item";
const uuid = require('node-uuid');

export interface SearchResultOptions {
    maxResults: number; // To be transformed by each connected app
}

export enum ServerAutomationRuleAction {
    CreatePlateItem
}

export interface IAutomationRule {
    id?: string;
    destPlate: string;
    when: string[];
    contains: string[];
    action: ServerAutomationRuleAction;
    connectedApp: string;
    creator: string;
    destHeader: string;
}

export interface ISimpleAutomationRule {
    id?: string;
    destPlate: string;
    when: string[];
    contains: string[];
    action: ServerAutomationRuleAction;
    connectedApp: string;
    creator: string;
    destHeader: string;
}

export const automationRuleWhenObjectOptions = {
    gmail: [
        'Subject',
        'To',
        'From'
    ]
}

// These interfaces are also reflected in the UI
export interface SearchResultsWithSize {
    searchResultsNoIcon: SearchResultNoIcon[];
    resultSizeEstimate: number;
}
export interface SearchResultNoIcon {
    id: string;
    type: ServerConnectedAppType;
    model: any;
    iconFileType: string;
    title: string;
    detailOne: string;
    detailTwo: string;
    snippet: string;
    timestamp: number;
    basePlateInstanceId: string;
}
export const enum ServerConnectedAppType {
    Native,
    Gmail,
    Slack
}

// This should probably go somewhere else
const ConnectedAppTypeInfo = {
    Gmail: {
        color: '#dd4b39'
    },
    Slack: {
        color: '#4D394B'
    },
    None: {
        color: '#000000'
    }
}

export interface ISimpleConnectedApp {
    id: string;
    name: string;
    type: ServerConnectedAppType;
    automationRules: ISimpleAutomationRule[];
    owner: string;
    color: string;
    created: number;
    nameIsCustom: boolean;
    overrideName: boolean; // Set this to true when creating a new custom name
    archived: boolean;
    gmail?: {
        email?: string;
    }
    slack?: {
        teamName?: string;
        defaultChannel?: string;
        userName?: string;
    }
}

export interface IConnectedApp extends mongoose.Document {
    id: string;
    name: string;
    type: ServerConnectedAppType;
    owner: string;
    color: string;
    created: number;
    nameIsCustom: boolean;
    archived: boolean;
    automationRules: IAutomationRule[];
    gmail?: {
        email?: string;
    }
    slack?: {
        teamName?: string;
        defaultChannel?: string;
    }
    // PRIVATE:
    _gmail: {
        tempToken?: string,
        tempTokenExpiration?: number,
        refreshToken?: string,
        accessToken?: string,
        accessTokenExpiration?: number,
        scope?: string,
        lastKnownHistoryId?: string
    }
    _slack: {
        tempToken?: string;
        tempTokenExpiration?: number;
        accessToken?: string;
        scope?: string;
    }
}

export interface IConnectedAppStatic extends mongoose.Model<IConnectedApp> {}

let ConnectedAppSchema = new mongoose.Schema({
    name: String,
    nameIsCustom: {
        type: Boolean,
        default: false
    },
    type: Number,
    owner: mongoose.Schema.Types.ObjectId,
    color: {
        type: String,
        default: '#0066CC'
    },
    archived: {
        type: Boolean,
        default: false
    },
    automationRules: [{
        destPlate: mongoose.Schema.Types.ObjectId,
        destHeader: mongoose.Schema.Types.ObjectId,
        when: [String],
        contains: [String],
        action: Number,
        connectedApp: mongoose.Schema.Types.ObjectId,
        creator: mongoose.Schema.Types.ObjectId
    }],
    gmail: {
        email: String
    },
    slack: {
        teamName: String,
        defaultChannel: String
    },
    _gmail: {
        tempToken: String,
        tempTokenExpiration: Number,
        refreshToken: String,
        accessToken: String,
        accessTokenExpiration: Number,
        lastKnownHistoryId: String
    },
    _slack: {
        tempToken: String,
        tempTokenExpiration: Number,
        accessToken: String,
        scope: String
    },
    // headers: [
    //     { name: String } // and ID of course
    // ], // Goals, Tasks
    created: {
        type: Date,
        default: Date.now
    }
});

export interface IConnectedAppStatic{ getConnectedAppsForUser(user: IUser): Q.Promise<IConnectedApp[]> }
ConnectedAppSchema.statics.getConnectedAppsForUser = function(user: IUser): Q.Promise<IConnectedApp[]> {
    let deferred = Q.defer<IConnectedApp[]>();

    ConnectedApp.find({
        'owner': user.id,
        archived: {
            $ne: true
        }
    }, function(err, connectedApps) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(connectedApps || []);
        }
    });

    return deferred.promise;
}

export interface IConnectedAppStatic{ verifyParameters(body: any): string }
ConnectedAppSchema.statics.verifyParameters = function(body: any): string {
    return null;
}

export interface IConnectedAppStatic{ getGmailConnectedAppsByEmail(email: string): Q.Promise<IConnectedApp[]> }
ConnectedAppSchema.statics.getGmailConnectedAppsByEmail = function(email: string): Q.Promise<IConnectedApp[]> {
    let deferred = Q.defer<IConnectedApp[]>();

    ConnectedApp.find({
        'gmail.email': email,
        archived: {
            $ne: true
        }
    }, function(err, connectedApps) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(connectedApps || []);
        }
    });

    return deferred.promise;
}

export interface IConnectedAppStatic{ newConnectedAppForUser(body: any, user: IUser): Q.Promise<IConnectedApp> }
ConnectedAppSchema.statics.newConnectedAppForUser = function(body: any, user: IUser): Q.Promise<IConnectedApp> {
    let deferred = Q.defer<IConnectedApp>();

    if (!body) {
        deferred.reject('Post body not found');
    } else {
        let name = body.name;
        let type = body.type;
        if (!name) {
            deferred.reject('Missing name parameter');
        } else {
            if (!isProperType(type)) {
                deferred.reject('Not a proper type for the connected app')
            } else {
                let newConnectedApp = new ConnectedApp();
                newConnectedApp.type = type;
                newConnectedApp.name = name;
                newConnectedApp.owner = user.id;

                switch (type) {
                    case ServerConnectedAppType.Gmail:
                        newConnectedApp.color = ConnectedAppTypeInfo.Gmail.color;
                        break;
                    case ServerConnectedAppType.Slack:
                        newConnectedApp.color = ConnectedAppTypeInfo.Slack.color;
                        break;
                    default:
                        newConnectedApp.color = ConnectedAppTypeInfo.None.color;
                        break;
                }

                newConnectedApp.save((err) => {
                	if (err) {
                		deferred.reject(err);
                	} else {
                	    deferred.resolve(newConnectedApp);
                	}
                })
            }
        }
    }

    return deferred.promise;
}

export interface IConnectedAppStatic{ getByIdForUser(user: IUser, id: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.statics.getByIdForUser = function(user: IUser, id: string): Q.Promise<IConnectedApp> {
    let deferred = Q.defer<IConnectedApp>();

    ConnectedApp.findById(id, function(err, connectedApp) {
        if (connectedApp.owner.toString() !== user.id) {
            deferred.reject('User doesn\'t have permission for connected app');
        } else {
            deferred.resolve(connectedApp);
        }
    });

    return deferred.promise;
}

export interface IConnectedAppStatic{ findByTempSlackToken(token: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.statics.findByTempSlackToken = function(token: string): Q.Promise<IConnectedApp> {
    let deferred = Q.defer<IConnectedApp>();

    ConnectedApp.findOne({
        '_slack.tempToken': token
    }, function(err, connectedApp) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(connectedApp);
        }
    });

    return deferred.promise;
}

export interface IConnectedAppStatic{ findByTempGmailToken(token: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.statics.findByTempGmailToken = function(token: string): Q.Promise<IConnectedApp> {
    let deferred = Q.defer<IConnectedApp>();

    ConnectedApp.findOne({
        '_gmail.tempToken': token
    }, function(err, connectedApp) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(connectedApp);
        }
    });

    return deferred.promise;
}

// For updating based on first authentication
// Just use the updateConnectedApp for all other use cases
export interface IConnectedApp{ initialConnectedAppName      (name: string, account: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.initialConnectedAppName = function(name: string, account: string): Q.Promise<IConnectedApp> {
    // NOTE: This saves the email in the account and should not be changed. The user should not have access to it / be able to change it
    // because later we access the connected app by the email alone.
    // Perhaps would be better to move saving the email to a new method.
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();
    if (name) {
        if (!thisConnectedApp.nameIsCustom) {
            thisConnectedApp.name = name;
        }
    }
    if (thisConnectedApp.type === ServerConnectedAppType.Gmail) {
        thisConnectedApp.gmail.email = account;
    }
    if (thisConnectedApp.type === ServerConnectedAppType.Slack) {
        thisConnectedApp.slack.teamName = account;
    }
    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp);
        }
    });
    return deferred.promise;
}

export interface IConnectedApp{ addAutomationRule      (user: IUser, automationRule: ISimpleAutomationRule): Q.Promise<ISimpleAutomationRule> }
ConnectedAppSchema.methods.addAutomationRule = function(user: IUser, automationRule: ISimpleAutomationRule): Q.Promise<ISimpleAutomationRule> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<ISimpleAutomationRule>();

    if (thisConnectedApp.automationRules.length > 5) {
        deferred.reject('Max automation rules reached');
    } else {
        let valid = true;
        if (!automationRule || automationRule.action !== ServerAutomationRuleAction.CreatePlateItem) {
            valid = false;
        } else if (!automationRule.contains || automationRule.contains.length !== 1 || automationRule.contains[0].length > 20) {
            valid = false;
        } else if (!automationRule.destPlate || !automationRule.destHeader) {
            valid = false;
        } else if (!automationRule.when || automationRule.when.length !== 1 || automationRule.when[0].length > 20) {
            valid = false;
        }

        if (!valid) {
            deferred.reject('Automation rule not valid');
        } else {
            Plate.getByIdForUser(user, automationRule.destPlate).then((plate) => {
                if (!plate) {
                    deferred.reject('No such plate found or user does not have access');
                } else {
                    thisConnectedApp.automationRules.push({
                        destPlate: automationRule.destPlate,
                        when: automationRule.when,
                        contains: automationRule.contains,
                        action: automationRule.action,
                        connectedApp: thisConnectedApp.id,
                        creator: user.id,
                        destHeader: automationRule.destHeader
                    });
                    thisConnectedApp.save((err) => {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            let simpleRule = simpleAutomationRule(thisConnectedApp.automationRules[thisConnectedApp.automationRules.length-1]);
                            deferred.resolve(simpleRule);
                        }
                    })
                }
            }).catch((reason) => {
                deferred.reject(reason);
            })
        }
    }

    return deferred.promise;
}

export interface IConnectedApp{ processGmailAutomationRule      (messages: gapi.client.gmail.Message[]): Q.Promise<boolean> }
ConnectedAppSchema.methods.processGmailAutomationRule = function(messages: gapi.client.gmail.Message[]): Q.Promise<boolean> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<boolean>();

    if (thisConnectedApp.automationRules && thisConnectedApp.automationRules.length && messages && messages.length) {
        for (let rawMessage of messages) {
            let decodeMessageDetails = PlateIntegrationServerGmailUtility.decodeMessageDetails(rawMessage);
            for (let automationRule of thisConnectedApp.automationRules) {
                const when = automationRule.when[0];
                let contains = automationRule.contains[0];
                if (when && contains) {
                    contains = contains.toLowerCase();
                    // Right now assume CreatePlateItem
                    let textToExamine = '';
                    if (when === 'Subject') {
                        textToExamine = decodeMessageDetails.subject.toLowerCase();
                    } else if (when === 'To') {
                        textToExamine = decodeMessageDetails.toHeader.toLowerCase();
                    } else if (when === 'From') {
                        textToExamine = decodeMessageDetails.fromHeader.toLowerCase();
                    }
                    if (textToExamine) {
                        if (textToExamine.indexOf(contains) > -1) {
                            User.getById(automationRule.creator).then((user) => {
                                Plate.getByIdForUser(user, automationRule.destPlate).then(([plate, platter]) => {
                                    const userPlate: IPlate = plate;
                                    if (!userPlate) {
                                        deferred.reject('No such plate found');
                                    } else {
                                        let connectedAppAttachmentObj: IConnectedAppAttachment = {
                                            app: ServerConnectedAppType.Gmail,

                                            // Shows up in UI:
                                            title: decodeMessageDetails.from,
                                            subtitle: decodeMessageDetails.subject,
                                            content: decodeMessageDetails.messageBody,

                                            identifier: rawMessage.id,
                                            connectedAppId: thisConnectedApp.id,
                                            itemDate: decodeMessageDetails.messageDate,

                                            // Custom:
                                            customIds: [],
                                            customDates: [],
                                            customDetails: [decodeMessageDetails.toHeader]
                                        };
                                        PlateItem.createPlateItemFromAutomationRule(user, plate, automationRule.destHeader, decodeMessageDetails.subject, [connectedAppAttachmentObj]).then((simplePlateItem) => {
                                            socketController.serverEventNewItemFromAutomationRule(user, thisConnectedApp, simplePlateItem);
                                        }).catch((reason) => {
                                            console.error(reason);
                                        })
                                    }
                                }).catch((reason) => {
                                    console.error(reason);
                                })
                            }).catch((reason) => {
                                console.error(reason);
                            })
                        }
                    }
                }
            }
        }
    }

    return deferred.promise;
}

export interface IConnectedApp{ removeAutomationRule      (user: IUser, automationRuleId: string): Q.Promise<boolean> }
ConnectedAppSchema.methods.removeAutomationRule = function(user: IUser, automationRuleId: string): Q.Promise<boolean> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<boolean>();

    let didRemove = false;
    for (let i=0; i < thisConnectedApp.automationRules.length; i++) {
        if (thisConnectedApp.automationRules[i].id === automationRuleId) {
            thisConnectedApp.automationRules.splice(i, 1);
            didRemove = true;
            break;
        }
    }

    if (!didRemove) {
        deferred.reject('No automation rule with that id found')
    } else {
        thisConnectedApp.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(true);
            }
        })
    }

    return deferred.promise;
}

export interface IConnectedApp{ saveGmailHistoryId      (historyId: string): Q.Promise<boolean> }
ConnectedAppSchema.methods.saveGmailHistoryId = function(historyId: string): Q.Promise<boolean> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<boolean>();
    thisConnectedApp._gmail.lastKnownHistoryId = historyId;
    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(true);
        }
    });
    return deferred.promise;
}

export interface IConnectedApp{ updateConnectedApp      (newBody: ISimpleConnectedApp, user: IUser): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.updateConnectedApp = function(newBody: ISimpleConnectedApp, user: IUser): Q.Promise<IConnectedApp> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();
    let somethingChanged = false;
    if (newBody.name) {
        if (newBody.name !== thisConnectedApp.name) {
            if (!thisConnectedApp.nameIsCustom) {
                thisConnectedApp.name = newBody.name;
                somethingChanged = true;
            } else if (newBody.overrideName) {
                thisConnectedApp.name = newBody.name;
                thisConnectedApp.nameIsCustom = true;
                somethingChanged = true;
            }
        }
    }
    let color = newBody.color;
    if (color !== thisConnectedApp.color) {
        thisConnectedApp.color = color;
        somethingChanged = true;
    }
    let archived = newBody.archived;
    if (archived === true && archived != thisConnectedApp.archived) {
        thisConnectedApp.archived = archived;
        thisConnectedApp._gmail = null;
        thisConnectedApp._slack = null;
        thisConnectedApp.gmail = null;
        thisConnectedApp.slack = null;
        socketController.serverEventConnectedAppArchived(thisConnectedApp);
        somethingChanged = true;
    }
    if (somethingChanged) {
        thisConnectedApp.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisConnectedApp);
            }
        });
    } else {
        deferred.resolve(thisConnectedApp);
    }

    return deferred.promise;
}

export interface IConnectedApp{ saveSlackAccessToken      (accessToken: string, scope: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.saveSlackAccessToken = function(accessToken: string, scope: string): Q.Promise<IConnectedApp> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();
    thisConnectedApp._slack = {
        accessToken: accessToken,
        scope: scope
    }
    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp);
        }
    });
    return deferred.promise;
}

export interface IConnectedApp{ saveTemporarySlackToken      (): Q.Promise<string> }
ConnectedAppSchema.methods.saveTemporarySlackToken = function(): Q.Promise<string> {
    let deferred = Q.defer<string>();

    const thisConnectedApp: IConnectedApp = this;
    //noinspection TypeScriptUnresolvedFunction
    thisConnectedApp._slack = {
        tempToken: uuid.v4(),
        // 30 minutes from now
        tempTokenExpiration: new Date(new Date().getTime() + 30*60000).getTime()
    }

    thisConnectedApp.save((err) => {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp._slack.tempToken);
        }
    });

    return deferred.promise;
}

export interface IConnectedApp{ saveTemporaryGmailToken      (): Q.Promise<string> }
ConnectedAppSchema.methods.saveTemporaryGmailToken = function(): Q.Promise<string> {
    let deferred = Q.defer<string>();

    const thisConnectedApp: IConnectedApp = this;
    //noinspection TypeScriptUnresolvedFunction
    thisConnectedApp._gmail = {
        tempToken: uuid.v4(),
        // 30 minutes from now
        tempTokenExpiration: new Date(new Date().getTime() + 30*60000).getTime()
    }

    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp._gmail.tempToken);
        }
    });

    return deferred.promise;
}

/**
 * Wipes out the custom temp "state" auth code and only saves the refresh token if it is defined in the parameter
 */
export interface IConnectedApp{ saveGmailRefreshToken      (refreshToken: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.saveGmailRefreshToken = function(refreshToken: string): Q.Promise<IConnectedApp> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();

    delete thisConnectedApp._gmail.tempToken;
    delete thisConnectedApp._gmail.tempTokenExpiration;
    if (refreshToken) {
        thisConnectedApp._gmail = {
            refreshToken: refreshToken,
        }
    }
    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp);
        }
    });

    return deferred.promise;
}

/**
 * Does not modify the refresh token or temp auth codes (which should be wiped out at this point)
 */
export interface IConnectedApp{ saveGmailAccessToken      (accessToken: string, expiration: number): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.saveGmailAccessToken = function(accessToken: string, expiration: number): Q.Promise<IConnectedApp> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();
    thisConnectedApp._gmail.accessToken = accessToken;
    thisConnectedApp._gmail.accessTokenExpiration = Date.now() + expiration*1000;
    thisConnectedApp.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisConnectedApp);
        }
    });

    return deferred.promise;
}

export interface IConnectedApp{ saveSlackDefaultChannel      (channelId: string): Q.Promise<IConnectedApp> }
ConnectedAppSchema.methods.saveSlackDefaultChannel = function(channelId: string): Q.Promise<IConnectedApp> {
    let thisConnectedApp: IConnectedApp = this;
    let deferred = Q.defer<IConnectedApp>();
    if (thisConnectedApp && thisConnectedApp.type === ServerConnectedAppType.Slack) {
        let somethingChanged = false;
        if (thisConnectedApp.slack.defaultChannel !== channelId) {
            thisConnectedApp.slack.defaultChannel = channelId;
            somethingChanged = true;
        }
        if (somethingChanged) {
            thisConnectedApp.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(thisConnectedApp);
                }
            });
        } else {
            deferred.resolve(thisConnectedApp);
        }
    }
    return deferred.promise;
}


export interface IConnectedApp{ search      (query: string, maxResults: number): Q.Promise<SearchResultsWithSize> }
ConnectedAppSchema.methods.search = function(query: string, maxResults: number): Q.Promise<SearchResultsWithSize> {
    let deferred = Q.defer<SearchResultsWithSize>();
    let thisConnectedApp: IConnectedApp = this;

    maxResults = +maxResults || 5;
    if (maxResults > 20) {
        maxResults = 20;
    }
    if (maxResults < 1) {
        maxResults = 1;
    }

    if (thisConnectedApp.type === ServerConnectedAppType.Gmail) {
        const accessToken = thisConnectedApp._gmail.accessToken;
        const refreshToken = thisConnectedApp._gmail.refreshToken;
        if (!accessToken || !refreshToken) {
            deferred.resolve({
                searchResultsNoIcon: [],
                resultSizeEstimate: 0
            });
        } else {
            GmailClientStatic.search(
                thisConnectedApp,
                query,
                { maxResults: maxResults })
                .then((searchResults) => {
                    deferred.resolve(searchResults);
                }).catch((reason) => {
                    deferred.reject(reason);
                });
        }
    } else if (thisConnectedApp.type === ServerConnectedAppType.Slack) {
        const accessToken = thisConnectedApp._slack.accessToken;
        if (!accessToken) {
            deferred.resolve({
                searchResultsNoIcon: [],
                resultSizeEstimate: 0
            });
        } else {
            SlackClientStatic.search(
                thisConnectedApp,
                query,
                { maxResults: maxResults })
                .then((searchResults) => {
                    deferred.resolve(searchResults);
                }).catch((reason) => {
                deferred.reject(reason);
            });
        }
    }

    return deferred.promise;
}

function simpleAutomationRule(automationRule: IAutomationRule): ISimpleAutomationRule {
    return {
        id: automationRule.id,
        destPlate: automationRule.destPlate,
        when: automationRule.when,
        contains: automationRule.contains,
        action: automationRule.action,
        connectedApp: automationRule.connectedApp,
        creator: automationRule.creator,
        destHeader: automationRule.destHeader
    }
}

function simpleAutomationRules(automationRules: IAutomationRule[]): ISimpleAutomationRule[] {
    let ret: ISimpleAutomationRule[] = [];
    for (let automationRule of automationRules) {
        ret.push(simpleAutomationRule(automationRule));
    }
    return ret;
}

export interface IConnectedApp{ simple      (): ISimpleConnectedApp }
ConnectedAppSchema.methods.simple = function(): ISimpleConnectedApp {
    let obj: ISimpleConnectedApp = {
        id: this.id,
        name: this.name,
        type: this.type,
        owner: this.owner,
        color: this.color,
        created: this.created,
        overrideName: false,
        nameIsCustom: this.nameIsCustom,
        archived: this.archived,
        automationRules: simpleAutomationRules(this.automationRules)
    }
    if (this.type === ServerConnectedAppType.Gmail) {

    }
    if (this.type === ServerConnectedAppType.Slack) {
        obj.slack = {};
        obj.slack.defaultChannel = this.slack.defaultChannel;
    }
    return obj;
}

function isProperType(type) {
    switch (type) {
        case ServerConnectedAppType.Gmail:
        case ServerConnectedAppType.Slack:
            return true;
    }
    return false;
}


mongoose.model('ConnectedApp', ConnectedAppSchema);
export const ConnectedApp: IConnectedAppStatic = <IConnectedAppStatic>mongoose.model('ConnectedApp');














