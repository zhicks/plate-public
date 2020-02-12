import * as Q from "q";
import * as request from "request";
import {GmailSearchOptions, GmailPostOptions} from "../../../../../typings/custom/gapi.gmail/custom";
import {PlateUtil} from "../../util/plate-util";
import {Config} from "../../config/config-service";
import {
    IConnectedApp, SearchResultNoIcon, SearchResultOptions,
    ServerConnectedAppType, SearchResultsWithSize
} from "../../models/connectedapps";
import ListLabelsResponse = gapi.client.gmail.ListLabelsResponse;
import ListMessagesResponse = gapi.client.gmail.ListMessagesResponse;

interface IGmailIdAndThreadObject {
    id: string;
    threadId: string;
}

const Constants = {
    urls: {
        profile: 'https://content.googleapis.com/gmail/v1/users/me/profile',
        labels: 'https://content.googleapis.com/gmail/v1/users/me/labels',
        messages: 'https://content.googleapis.com/gmail/v1/users/me/messages',
        watch: 'https://www.googleapis.com/gmail/v1/users/me/watch',
        stop: 'https://www.googleapis.com/gmail/v1/users/me/stop',
        list: 'https://www.googleapis.com/gmail/v1/users/me/history',
        refreshToken: 'https://www.googleapis.com/oauth2/v4/token',
        send: 'https://www.googleapis.com/gmail/v1/users/me/messages/send'
    }
}

export class GmailClient {

    private refreshToken: string;
    private accessToken: string;
    private accessTokenExpiration: number; // Note that expiration comes back as 3600 seconds from the token. The app will have accessTokenExpiration at [msAtTimeOfRetrieval + 3600*1000]
    private connectedApp: IConnectedApp;
    private connectedAppId: string;
    private clientSocket: SocketIO.Socket;

    private watch = {
        isWatching: false
    }

    hasBeenAuthenticated = false;

    constructor(clientSocket: SocketIO.Socket, connectedApp: IConnectedApp, accessToken: string, refreshToken: string, accessTokenExpiration: number) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.clientSocket = clientSocket;
        this.connectedAppId = connectedApp.id;
        this.connectedApp = connectedApp;
        this.accessTokenExpiration = accessTokenExpiration;
        this.onAuthenticatedFromGmail();

        // TEST!
        this.startWatch();
    }

    // ------------------------------------------------------------------- Watch
    startWatch() {
        if (Config.isProduction()) {
            this.watch.isWatching = true;
            this.getAccessTokenIfNeeded().then((result) => {
                this.sendWatch().then((watchResponse) => {
                    this.connectedApp.saveGmailHistoryId(watchResponse.historyId);
                    // All changes after that historyId will be notified to your client.
                    // You must re-call watch() every 7 days or else you will stop receiving updates for the user.
                    // The watch() response also has an expiration field with the timestamp for the watch expiration.
                }).catch((reason) => {
                    console.error(reason);
                });
            }).catch((reason) => {
                console.error(reason);
            });
        }
    }

    stopWatch() {
        if (Config.isProduction() && this.watch.isWatching) {
            this.getAccessTokenIfNeeded().then((result) => {
                this.sendStopWatch().then((empty) => {
                    this.watch.isWatching = false;
                }).catch((reason) => {
                    console.error(reason);
                })
            }).catch((reason) => {
                console.error(reason);
            });
        }
    }

    // ------------------------------------------------------------------- Events from the User
    onListLabelsFromUser() {
        this.getAccessTokenIfNeeded().then((result) => {
            this.listLabels().then((labels) => {
                this.clientSocket.emit('gmail labels', { connectedAppId: this.connectedAppId, labels: labels });
            }).catch((reason) => {
                console.error(reason);
            });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    onListMessagesForLabelFromUser(labelId: string) {
        this.getAccessTokenIfNeeded().then((result) => {
            this.listMessagesForLabel(labelId).then((messages) => {
                this.clientSocket.emit('gmail messages for label', { connectedAppId: this.connectedAppId, messages: messages });
            }).catch((reason) => {
                console.error(reason);
            });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    onMarkMessageAsRead(messageId: string) {
        this.getAccessTokenIfNeeded().then((result) => {
            this.markMessageAsRead(messageId).then((message) => {
                // Do nothing
            }).catch((reason) => {
                console.error(reason);
            });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    onUserSendEmail(raw: string, threadId: string) {
        this.getAccessTokenIfNeeded().then((result) => {
            this.sendEmail(raw, threadId).then((message) => {
                this.clientSocket.emit('gmail email sent', { connectedAppId: this.connectedAppId });
            }).catch((reason) => {
                console.error(reason);
            });
        }).catch((reason) => {
            console.error(reason);
        });
    }

    // ------------------------------------------------------------------- Events from Gmail
    sendSocketReady() {
        this.clientSocket.emit('gmail socket ready', { connectedAppId: this.connectedAppId })
    }
    private onAuthenticatedFromGmail() {
        this.hasBeenAuthenticated = true;
        this.sendSocketReady();
    }
    private onUnableToStart () {
        // We will test this to see how reliable it is after just one go
        this.clientSocket.emit('gmail socket unable to start', { connectedAppId: this.connectedAppId })
    }

    onNewMessagesFromWatch(messages: gapi.client.gmail.Message[]) {
        if (this.watch.isWatching) {
            this.clientSocket.emit('gmail messages from watch', { connectedAppId: this.connectedAppId, messages: messages });
        }
    }

    // ------------------------------------------------------------------- Utility

    private sendWatch(): Q.Promise<gapi.client.gmail.WatchResponse> {
        let deferred = Q.defer<gapi.client.gmail.WatchResponse>();
        this.authRequestPost<gapi.client.gmail.WatchResponse>(Constants.urls.watch, {
            topicName: Config.Keys.Providers.Gmail.PUB_SUB_TOPIC_NAME,
            labelIds: ['INBOX']
        }).then((watchResponse: gapi.client.gmail.WatchResponse) => {
            deferred.resolve(watchResponse);
        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    private sendStopWatch(): Q.Promise<any> {
        let deferred = Q.defer<any>();
        this.authRequestPost<any>(Constants.urls.stop, null).then((empty: any) => {
            deferred.resolve(empty);
        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    private listLabels(): Q.Promise<gapi.client.gmail.Label[]> {
        let deferred = Q.defer<gapi.client.gmail.Label[]>();
        this.authRequestGet<gapi.client.gmail.Label[]>(Constants.urls.labels).then((labelReponse: ListLabelsResponse) => {
        	deferred.resolve(labelReponse.labels);
        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    private listMessagesForLabel(labelName: string): Q.Promise<gapi.client.gmail.Message[]> {
        let deferred = Q.defer<gapi.client.gmail.Message[]>();
        const requestOptions: GmailSearchOptions = {
            maxResults: 20
        }
        const query = 'in:' + labelName;
        requestOptions.q = query;
        this.authRequestGet<gapi.client.gmail.Message[]>(Constants.urls.messages, requestOptions).then((messageResponse: ListMessagesResponse) => {

            const nextPageToken = messageResponse.nextPageToken;
            const messageIdAndThreadObjects: IGmailIdAndThreadObject[] = <IGmailIdAndThreadObject[]>messageResponse.messages;

            // Now get the actual email content
            if (messageIdAndThreadObjects && messageIdAndThreadObjects.length) {
                GmailClientStatic.getManyMessagesById(this.accessToken, messageIdAndThreadObjects.map(val => val.id)).then((messages) => {
                    deferred.resolve(messages);
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            } else {
                deferred.resolve([]);
            }

        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    private markMessageAsRead(messageId: string): Q.Promise<gapi.client.gmail.Message> {
        let deferred = Q.defer<gapi.client.gmail.Message>();

        GmailClientStatic.authRequestPost<gapi.client.gmail.Message>(this.accessToken, Constants.urls.messages, {
            id: messageId,
            urlSuffix: 'modify',
            removeLabelIds: ['UNREAD']
        }).then((message) => {
        	deferred.resolve(message);
        }).catch((reason) => {
            deferred.reject(reason);
        })

        return deferred.promise;
    }

    private sendEmail(raw: string, threadId: string): Q.Promise<gapi.client.gmail.Message> {
        let deferred = Q.defer<gapi.client.gmail.Message>();

        let payload: any = {
            raw: raw
        }
        if (threadId) {
            payload.threadId = threadId;
        }
        GmailClientStatic.authRequestPost<gapi.client.gmail.Message>(this.accessToken, Constants.urls.send, payload).then((message) => {
            deferred.resolve(message);
        }).catch((reason) => {
            deferred.reject(reason);
        })

        return deferred.promise;
    }

    private authRequestGet<T>(url: string, options?: GmailSearchOptions): Q.Promise<T> {
        return GmailClientStatic.authRequestGet<T>(this.accessToken, url, options);
    }

    private authRequestPost<T>(url: string, options: GmailPostOptions): Q.Promise<T> {
        return GmailClientStatic.authRequestPost<T>(this.accessToken, url, options);
    }

    private getAccessTokenIfNeeded(): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        GmailClientStatic.getAccessTokenIfNeeded(this.refreshToken, this.accessToken, this.accessTokenExpiration, this.connectedApp).then((tokenDetailsFromApp) => {
        	this.accessToken = tokenDetailsFromApp.accessToken;
        	this.accessTokenExpiration = tokenDetailsFromApp.accessTokenExpiration;
            deferred.resolve(true);
        }).catch((reason) => {
            deferred.reject(reason);
        })
        return deferred.promise;
    }

}

// Will probably end up moving most things here
export class GmailClientStatic {

    static getProfile(accessToken: string): Q.Promise<gapi.client.gmail.Profile> {
        let deferred = Q.defer<gapi.client.gmail.Profile>();
        this.authRequestGet<gapi.client.gmail.Profile>(accessToken, Constants.urls.profile).then((profileResponse: gapi.client.gmail.Profile) => {
            deferred.resolve(profileResponse);
        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    static search(connectedApp: IConnectedApp, query: string, options: SearchResultOptions): Q.Promise<SearchResultsWithSize> {
        let deferred = Q.defer<SearchResultsWithSize>();
        const refreshToken = connectedApp._gmail.refreshToken;
        const accessToken = connectedApp._gmail.accessToken;
        const accessTokenExpiration = connectedApp._gmail.accessTokenExpiration;
        const accountName = connectedApp.gmail.email;

        const gmailSearchOptions: GmailSearchOptions = options;
        gmailSearchOptions.q = query;
        GmailClientStatic.getAccessTokenIfNeeded(refreshToken, accessToken, accessTokenExpiration, connectedApp).then((tokenDetailsFromApp) => {
            let accessToken = tokenDetailsFromApp.accessToken;
            let accessTokenExpiration = tokenDetailsFromApp.accessTokenExpiration;
            GmailClientStatic.authRequestGet<ListMessagesResponse>(accessToken, Constants.urls.messages, options).then((resp) => {
                const messageIdAndThreadObjects: IGmailIdAndThreadObject[] = <IGmailIdAndThreadObject[]>resp.messages;
                let resultSizeEstimate = resp.resultSizeEstimate;
                // Now get the actual email content
                if (messageIdAndThreadObjects && messageIdAndThreadObjects.length) {
                    this.getManyMessagesById(accessToken, messageIdAndThreadObjects.map(val => val.id)).then((messages) => {
                        let searchResults: SearchResultNoIcon[] = [];
                        for (let gmailMessage of messages) {
                            const fromHeader = PlateIntegrationServerGmailUtility.getHeader(gmailMessage.payload.headers, 'From');
                            searchResults.push({
                                id: gmailMessage.id,
                                basePlateInstanceId: connectedApp.id,
                                type: ServerConnectedAppType.Gmail,
                                model: gmailMessage,
                                iconFileType: 'png',
                                title: PlateIntegrationServerGmailUtility.getHeader(gmailMessage.payload.headers, 'Subject'),
                                detailOne: `${accountName}`,
                                detailTwo: `${PlateIntegrationServerGmailUtility.nameOnlyForFromHeader(fromHeader)}`,
                                snippet: gmailMessage.snippet,
                                timestamp: +PlateIntegrationServerGmailUtility.dateFromHeader(PlateIntegrationServerGmailUtility.getHeader(gmailMessage.payload.headers, 'Date'))
                            });
                        }
                        deferred.resolve({
                            searchResultsNoIcon: searchResults,
                            resultSizeEstimate: resultSizeEstimate
                        });
                    }).catch((reason) => {
                        console.log('error in getting gmail');
                    });
                } else {
                    deferred.resolve({
                        searchResultsNoIcon: [],
                        resultSizeEstimate: 0
                    });
                }
            }).catch((reason) => {
                deferred.reject(reason);
            })
        }).catch(reason => deferred.reject(reason));

        return deferred.promise;
    }

    static getEmailsFromHistoryId(connectedApp: IConnectedApp, historyId: string): Q.Promise<gapi.client.gmail.Message[]> {
        let deferred = Q.defer<gapi.client.gmail.Message[]>();
        const refreshToken = connectedApp._gmail.refreshToken;
        const accessToken = connectedApp._gmail.accessToken;
        const accessTokenExpiration = connectedApp._gmail.accessTokenExpiration;
        GmailClientStatic.getAccessTokenIfNeeded(refreshToken, accessToken, accessTokenExpiration, connectedApp).then((tokenDetailsFromApp) => {
            let accessToken = tokenDetailsFromApp.accessToken;
            let historyIdToGet = connectedApp._gmail.lastKnownHistoryId;
            if (historyIdToGet) {
                GmailClientStatic.authRequestGet<gapi.client.gmail.ListHistoryResponse>(accessToken, Constants.urls.list, {startHistoryId: historyIdToGet, maxResults: 20}).then((historyResponse) => {
                    if (historyResponse) {
                        let history = historyResponse.history;
                        let idsToGet: string[] = [];
                        for (let historyItem of history) {
                            if (historyItem.messagesAdded && historyItem.messagesAdded.length) {
                                for (let message of historyItem.messagesAdded) {
                                    idsToGet.push(message.message.id);
                                }
                            }
                        }
                        if (idsToGet.length) {
                            GmailClientStatic.getManyMessagesById(accessToken, idsToGet).then((messages) => {
                                deferred.resolve(messages);
                            }).catch((reason) => {
                                console.error(reason);
                            });
                        }
                    }
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            }
            connectedApp.saveGmailHistoryId(historyId);
        }).catch(reason => deferred.reject(reason));

        return deferred.promise;
    }

    static getManyMessagesById(token: string, ids: string[]): Q.Promise<gapi.client.gmail.Message[]> {
        let deferred = Q.defer<gapi.client.gmail.Message[]>();
        let arrayToAddTo: gapi.client.gmail.Message[] = [];
        let retrievedEmailCount = 0;
        ids = ids || [];
        for (let i = 0; i < ids.length; i++) {
            let id = ids[i];
            GmailClientStatic.getSingleMessageById(token, id).then((message) => {
                retrievedEmailCount++;
                arrayToAddTo.push(message);
                if (retrievedEmailCount >= ids.length) {
                    deferred.resolve(arrayToAddTo);
                }
            }).catch((reason) => {
                deferred.reject(reason);
            });
        }
        return deferred.promise;
    }

    static getSingleMessageById(token:string, id: string): Q.Promise<gapi.client.gmail.Message> {
        let deferred = Q.defer<gapi.client.gmail.Message>();
        let options: GmailSearchOptions = {
            id: id
        }
        GmailClientStatic.authRequestGet<gapi.client.gmail.Message>(token, Constants.urls.messages, options).then((message) => {
            deferred.resolve(message);
        }).catch((reason) => {
            deferred.reject(reason);
        });
        return deferred.promise;
    }

    static getAccessTokenIfNeeded(refreshToken: string, accessToken: string, accessTokenExpiration: number, connectedApp: IConnectedApp): Q.Promise<{ accessToken: string, accessTokenExpiration: number }> {
        let deferred = Q.defer<{ accessToken: string, accessTokenExpiration: number }>();
        let diffInMinutes = PlateUtil.getDiffInMinutes(new Date(accessTokenExpiration), new Date());
        if (diffInMinutes >= 15) {
            deferred.resolve({
                accessToken: accessToken,
                accessTokenExpiration: accessTokenExpiration
            });
        } else {
            // https://developers.google.com/identity/protocols/OAuth2WebServer
            let requestOptions = {
                method: 'POST',
                url: Constants.urls.refreshToken,
                form: {
                    refresh_token: refreshToken,
                    client_id: Config.Keys.Providers.Google.CLIENT_ID,
                    client_secret: Config.Keys.Providers.Google.CLIENT_SECRET,
                    grant_type: 'refresh_token'
                }
            }
            request(requestOptions, (err, httpResponse, body) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    try {
                        let parsedBody: any = JSON.parse(body);
                        let accessToken = parsedBody.access_token;
                        let expiration = +parsedBody.expires_in;
                        connectedApp.saveGmailAccessToken(accessToken, expiration).then((connectedApp) => {
                            deferred.resolve({
                                accessToken: connectedApp._gmail.accessToken,
                                accessTokenExpiration: connectedApp._gmail.accessTokenExpiration
                            });
                        }).catch((reason) => {
                            deferred.reject(reason);
                        })
                    } catch (e) {
                        deferred.reject(e);
                    }

                }
            });
        }
        return deferred.promise;
    }

    static authRequestGet<T>(accessToken: string, url: string, options?: GmailSearchOptions): Q.Promise<T> {
        let deferred = Q.defer<T>();
        if (options) {
            // Take care of ID first
            if (options.id) {
                url += '/' + options.id;
            }
            delete options.id;
            if (Object.keys(options)) {
                url += '?';
                let added = 0;
                let numKeys = Object.keys(options).length;
                for (let key in options) {
                    url += key + '=' + options[key];
                    added++;
                    if (added < numKeys) {
                        url += '&';
                    }
                }
            }
        }
        let requestOptions = {
            method: 'GET',
            url: url,
            headers: {
                'Authorization': "Bearer " + accessToken
            }
        }
        request(requestOptions, (err, httpResponse, body) => {
            if (err) {
                deferred.reject(err);
            } else {
                try {
                    let ret = JSON.parse(body);
                    deferred.resolve(ret);
                } catch (e) {
                    deferred.reject(e);
                }

            }
        });
        return deferred.promise;
    }

    static authRequestPost<T>(accessToken: string, url: string, options?: GmailPostOptions): Q.Promise<T> {
        let deferred = Q.defer<T>();
        if (options) {
            if (options.id) {
                url += '/' + options.id;
            }
            if (options.urlSuffix) {
                url += '/' + options.urlSuffix;
            }
            delete options.id;
            delete options.urlSuffix;
        }
        let requestOptions = {
            method: 'POST',
            url: url,
            headers: {
                'Authorization': "Bearer " + accessToken
            },
            json: options
        }
        request(requestOptions, (err, httpResponse, body) => {
            if (err) {
                deferred.reject(err);
            } else {
                try {
                    let ret = body;
                    deferred.resolve(ret);
                } catch (e) {
                    deferred.reject(e);
                }

            }
        });
        return deferred.promise;
    }

}

/**
 * Stuff like parsing emails - no server contact
 * TODO - We have two copies of methods in this class - one on the server and one on the client. There are limited differences
 */
export interface DecodedGmailMessageDetails {
    fromHeader: string
    from: string
    toHeader: string
    subject: string
    messageDate: number
    messageBody: string
}
export class PlateIntegrationServerGmailUtility {

    static decodeMessageDetails(message: gapi.client.gmail.Message): DecodedGmailMessageDetails {
        const fromHeader = PlateIntegrationServerGmailUtility.getHeader(message.payload.headers, 'From') || '';
        const from = PlateIntegrationServerGmailUtility.nameOnlyForFromHeader(fromHeader);
        const toHeader = PlateIntegrationServerGmailUtility.getHeader(message.payload.headers, 'To') || '';
        const subject = PlateIntegrationServerGmailUtility.getHeader(message.payload.headers, 'Subject') || '';
        const messageDate = PlateIntegrationServerGmailUtility.dateFromHeader(PlateIntegrationServerGmailUtility.getHeader(message.payload.headers, 'Date'));
        const messageBody = PlateIntegrationServerGmailUtility.getBody(message, true);
        return {
            fromHeader: fromHeader,
            from: from,
            toHeader: toHeader,
            subject: subject,
            messageDate: messageDate,
            messageBody: messageBody
        }
    }

    static getBody(message: gapi.client.gmail.Message, toText?: boolean) {
        const payload = message.payload;
        let encodedBody = '';
        if (typeof payload.parts === 'undefined' && payload.body) {
            encodedBody = payload.body.data;
        } else {
            encodedBody = toText ? this.getTextPart(payload.parts) : this.getHTMLPart(payload.parts);
        }
        encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
        return decodeURIComponent(PlateUtil.decodeBase64(encodedBody));
    }

    static getHTMLPart(arr) {
        if (!arr) {
            return '';
        }
        for (let x = 0; x <= arr.length; x++) {
            if (typeof arr[x].parts === 'undefined') {
                if (arr[x].mimeType === 'text/html') {
                    return arr[x].body.data;
                }
            } else {
                return this.getHTMLPart(arr[x].parts);
            }
        }
        return '';
    }

    static getTextPart(arr) {
        if (!arr) {
            return '';
        }
        for (let x = 0; x <= arr.length; x++) {
            if (typeof arr[x].parts === 'undefined') {
                if (arr[x].mimeType === 'text/plain') {
                    return arr[x].body.data;
                }
            } else {
                return this.getTextPart(arr[x].parts);
            }
        }
        return '';
    }

    static getHeader(headers: gapi.client.gmail.MessagePartHeader[], name: string): string {
        let header = '';
        for (let header2 of headers) {
            if(header2.name === name){
                header = header2.value;
                break;
            }
        };
        return header;
    }

    static nameOnlyForFromHeader(value: string): string {
        return value.substring(0, value.lastIndexOf('<')).trim();
    }

    static dateFromHeader(value: string): number {
        return new Date(value).getTime();
    }
}