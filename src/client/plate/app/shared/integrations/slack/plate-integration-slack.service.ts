import {Injectable} from "@angular/core";
import {Http} from "@angular/http";
import {ClientUtil} from "../../../../../shared/scripts/util.service";
import {AuthHttp} from "angular2-jwt/angular2-jwt";
import {SlackApiChannelOrUserGroup, SlackApiMessageWithUserObj} from "../../../../../../../typings/custom/slack/slack";
import {SlackPlateComponent} from "../../../+plates/slack/slack-plate.component";

export class UIClientSlackPlateMessage {
    model: SlackApiMessageWithUserObj;
    submessages: UIClientSlackPlateMessage[];
    domId: string; // Messages don't have IDs, and timestamps have a dot in them that apparently breaks getting the element by ID

    constructor(model: SlackApiMessageWithUserObj, submessages: UIClientSlackPlateMessage[], domId: string) {
        this.model = model;
        this.model.text = UIClientSlackPlateMessage.transformTextForSlack(this.model.text);
        this.submessages = submessages;
        this.domId = domId;
    }

    static transformTextForSlack(text: string) {
        /*
         Detect all sequences matching <(.*?)>
         Within those sequences, format content starting with #C as a channel link
         Within those sequences, format content starting with @U as a user link
         Within those sequences, format content starting with ! according to the rules for the special command.
         For remaining sequences, format as a link
         Once the format has been determined, check for a pipe - if present, use the text following the pipe as the link label
         */
        if (text) {
            let originalText = text;
            var re = /<(.*?)>/;
            if (re.test(text)) {
                try {
                    let indexOfFirstAngle = text.indexOf('<');
                    let textAfterThat = text.substring(indexOfFirstAngle);
                    let indexOfPipe = textAfterThat.indexOf('|');
                    textAfterThat = text.substring(indexOfPipe);
                    let indexOfNextAngle = textAfterThat.indexOf('>');
                    let betweenPipeAndAngle = textAfterThat.substring(1, indexOfNextAngle);
                    text = text.replace(/<(.*?)>/, betweenPipeAndAngle);
                } catch (e) {
                    return originalText;
                }
            }
            return text;
        }
    }
}
export interface ClientSlackChannel {
    model: SlackApiChannelOrUserGroup;
}

export class PlateIntegrationSlackServiceStatic {

    static messageAndChannelCache: {
        [appId: string]: {
            messages: UIClientSlackPlateMessage[],
            channels: ClientSlackChannel[],
            channel: ClientSlackChannel
        }
    } = {};

    static getDateForSlackWeirdTimestamp(messageTsString: string) {
        let stringValue = messageTsString;
        stringValue = stringValue.replace('.', '');
        return new Date(+stringValue.substring(0, stringValue.length - 3));
    }
    static getDomIdentifierForMessage(message: SlackApiMessageWithUserObj) {
        return message.user + '-' + message.channel + '-' + message.ts.replace('.', '');
    }

    static getSlackMessageOrAddToPreviousForRaw(message: SlackApiMessageWithUserObj, previousSlackMessage: UIClientSlackPlateMessage): UIClientSlackPlateMessage {
        if (message) {
            let previousSlackMessageDate;
            let rawMessageDate;
            if (previousSlackMessage) {
                rawMessageDate = PlateIntegrationSlackServiceStatic.getDateForSlackWeirdTimestamp(message.ts);
                previousSlackMessageDate = PlateIntegrationSlackServiceStatic.getDateForSlackWeirdTimestamp(previousSlackMessage.model.ts);
            }
            // If the previous message was the same user within a certain time frame, make it a submessage
            if (previousSlackMessage && previousSlackMessage.model.userObj.id === message.userObj.id && ClientUtil.getDiffInMinutes(rawMessageDate, previousSlackMessageDate) < 10) {
                previousSlackMessage.submessages.push(new UIClientSlackPlateMessage(message, [], null));
                return null;
            } else {
                let slackMessage = new UIClientSlackPlateMessage(message, [], PlateIntegrationSlackServiceStatic.getDomIdentifierForMessage(message))
                return slackMessage;
            }
        }
    }

    static setCacheFor(app: SlackPlateComponent, channel: ClientSlackChannel) {
        PlateIntegrationSlackServiceStatic.messageAndChannelCache[app.base.model.id] = {
            messages: app.slackMessages,
            channels: app.slackChannels,
            channel: channel
        }
    }

    static getCacheFor(app: SlackPlateComponent) {
        return PlateIntegrationSlackServiceStatic.messageAndChannelCache[app.base.model.id];
    }

    static newMessageForCache(connectedAppId: string, message: SlackApiMessageWithUserObj) {
        let cacheObj = PlateIntegrationSlackServiceStatic.messageAndChannelCache[connectedAppId];
        if (cacheObj) {
            if (cacheObj.channel.model.id === message.channel) {
                let mostRecentMessage = cacheObj.messages[cacheObj.messages.length];
                let slackMessage = PlateIntegrationSlackServiceStatic.getSlackMessageOrAddToPreviousForRaw(message, mostRecentMessage);
                if (slackMessage) {
                    cacheObj.messages.push(slackMessage);
                }
            }
        }
    }

}

@Injectable()
/**
 * A class with stuff explicitly specific to a Plate existing - mainly for the cache.
 */
export class PlateIntegrationSlackServiceForPlate {

    constructor(
        private util: ClientUtil,
        private http: Http,
        private authHttp: AuthHttp
    ) { }

}






