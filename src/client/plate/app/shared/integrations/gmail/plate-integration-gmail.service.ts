import {Injectable} from "@angular/core";
import {Http} from "@angular/http";
import {SearchOptions, SearchResultNoIcon} from "../../api/search.service";
import ListMessagesResponse = gapi.client.gmail.ListMessagesResponse;
import ListLabelsResponse = gapi.client.gmail.ListLabelsResponse;
import {GmailPlateComponent} from "../../../+plates/gmail/gmail-plate.component";
import {ClientUtil} from "../../../../../shared/scripts/util.service";

declare const escape: any;

export interface ClientGmailLabel {
    model: gapi.client.gmail.Label;
}

export interface ClientGmailMessage {
    id: string;
    subject: string;
    from: string;
    fromBrackets: string;
    fromAddress: string;
    fromFull: string;
    references: string;
    inReplyTo: string;
    to: string;
    toFull: string;
    snippet: string;
    labels: string[];
    date: number;
    unread: boolean;
    expanded: MessageUIExpansion;
    threadId: string;
    model: gapi.client.gmail.Message;
}

export enum MessageUIExpansion {
    NotExpanded,
    Expanded,
    Expanding,
    Contracting
}

export class PlateIntegrationGmailServiceStatic {

    static messageAndChannelCache: {
        [appId: string]: {
            messages: ClientGmailMessage[],
            labels: ClientGmailLabel[],
            label: ClientGmailLabel
        }
    } = {};

    static sortMessages(messages: ClientGmailMessage[]) {
        messages.sort((a, b) => {
            return <any>b.model.internalDate - <any>a.model.internalDate;
        });
    }

    static setCacheFor(app: GmailPlateComponent, label: ClientGmailLabel) {
        PlateIntegrationGmailServiceStatic.messageAndChannelCache[app.base.model.id] = {
            messages: app.gmailMessages,
            labels: app.gmailLabels,
            label: label
        }
    }

    static getCacheFor(app: GmailPlateComponent) {
        return PlateIntegrationGmailServiceStatic.messageAndChannelCache[app.base.model.id];
    }

}

@Injectable()
/**
 * A class with stuff explicitly specific to a Plate existing - mainly for the cache.
 */
export class PlateIntegrationGmailServiceForPlate {


}

/**
 * Stuff like parsing emails - no server contact
 * TODO - We have two copies of methods in this class - one on the server and one on the client
 */
export class PlateIntegrationGmailUtility {
    static getHTMLPart(arr) {
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

    static getBody(message: gapi.client.gmail.Message, text?: boolean) {
        const payload = message.payload;
        let encodedBody = '';
        if (typeof payload.parts === 'undefined' && payload.body) {
            encodedBody = payload.body.data;
        } else {
            encodedBody = text ? this.getTextPart(payload.parts) : this.getHTMLPart(payload.parts);
        }
        encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
        return decodeURIComponent(escape(window.atob(encodedBody)));
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

    static bracketsOnlyForFromHeader(value: string): string {
        return value.substring(value.lastIndexOf('<')).trim();
    }

    static stripBrackets(value: string): string {
        value = value.substring(1);
        value = value.substring(0, value.length);
        return value;
    }

    static dateFromHeader(value: string): number {
        return new Date(value).getTime();
    }

    static isMessageUnread(message: gapi.client.gmail.Message): boolean {
        for (let label of message.labelIds) {
            if (label === 'UNREAD') {
                return true;
            }
        }
    }

    static getToNameFromMessage(message: gapi.client.gmail.Message): string {
        const toHeader = this.getHeader(message.payload.headers, 'To');
        return this.nameOnlyForFromHeader(toHeader);
    }
    static getFromNameFromMessage(message: gapi.client.gmail.Message): string {
        const fromHeader = this.getHeader(message.payload.headers, 'From');
        return this.nameOnlyForFromHeader(fromHeader);
    }

    static gmailRawToMessage(message: gapi.client.gmail.Message): ClientGmailMessage {
        const fromHeader = this.getHeader(message.payload.headers, 'From');
        const toHeader = this.getHeader(message.payload.headers, 'To');
        const fromBrackets = this.bracketsOnlyForFromHeader(fromHeader);
        /*
         The "References:" field will contain the contents of the parent's
         "References:" field (if any) followed by the contents of the parent's
         "Message-ID:" field (if any).  If the parent message does not contain
         a "References:" field but does have an "In-Reply-To:" field
         containing a single message identifier, then the "References:" field
         will contain the contents of the parent's "In-Reply-To:" field
         followed by the contents of the parent's "Message-ID:" field (if
         any).  If the parent has none of the "References:", "In-Reply-To:",
         or "Message-ID:" fields, then the new message will have no
         "References:" field.
         */
        return {
            id: message.id,
            subject: this.getHeader(message.payload.headers, 'Subject'),
            from: this.nameOnlyForFromHeader(fromHeader),
            fromFull: fromHeader,
            fromBrackets: fromBrackets,
            references: this.getHeader(message.payload.headers, 'References'),
            fromAddress: this.stripBrackets(fromBrackets),
            to: this.nameOnlyForFromHeader(toHeader),
            toFull: toHeader,
            snippet: ClientUtil.decodeHtmlEntities(message.snippet),
            labels: message.labelIds,
            date: this.dateFromHeader(this.getHeader(message.payload.headers, 'Date')),
            unread: this.isMessageUnread(message),
            expanded: MessageUIExpansion.NotExpanded,
            threadId: message.threadId,
            inReplyTo: this.getHeader(message.payload.headers, 'Message-ID'),
            model: message
        }
    }

}




/**
 * Polls for new gmail every X milliseconds after the original historyId
 */
// private listeningHistoryId = null;
// listen(ms: number, historyId: string, newMessagesCallback: (messages: PlateGmailMessage[]) => void) {
//
//     // When we start using the server:
//
//     //https://developers.google.com/gmail/api/v1/reference/users/watch
//     //https://cloud.google.com/pubsub/access_control
//     //https://developers.google.com/gmail/api/guides/push
//     // gapi.client.gmail.users.watch(<any>{
//     //     userId: 'me',
//     //     // labelIds: [
//     //     //     'INBOX'
//     //     // ],
//     //     // labelFilterAction: 'include',
//     //     topicName: 'projects/plate-1375/topics/plate-work'
//     // }).execute((response) => {
//     //     console.log(response);
//     // });
//
//     const label = 'INBOX';
//     this.listeningHistoryId = historyId;
//     setInterval(() => {
//         gapi.client.gmail.users.history.list({
//             labelId: label,
//             startHistoryId: this.listeningHistoryId,
//             userId: 'me'
//         }).execute((response) => {
//             //console.log(response);
//             if (response && response.result.history) {
//                 let idsToGet = [];
//                 for (let historyItem of response.result.history) {
//                     if (historyItem.messagesAdded && historyItem.messagesAdded.length) {
//                         console.log('messages were added');
//                         for (let message of historyItem.messagesAdded) {
//                             idsToGet.push(message.message.id);
//                         }
//                     }
//                 }
//                 if (idsToGet.length) {
//                     this.getManyMessagesById(idsToGet, this.cache.messagesByLabel[label].messages).then((messages) => {
//                         console.log('new gmail messages');
//                     	console.log(messages);
//                         newMessagesCallback([]);
//                     }).catch((reason) => {
//                         console.log('error in listening');
//                     });
//                 }
//             }
//             this.listeningHistoryId = response.result.historyId;
//         });
//     }, ms);
// }





