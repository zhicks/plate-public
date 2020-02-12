import * as express from "express";
import {PlateUtil} from "../util/plate-util";
import {socketController} from "../socket/socket-controller";
import {ConnectedApp} from "../models/connectedapps";
import {GmailClientStatic} from "../integrations/slack/gmail-client";

const app = express();

interface GmailWatchHookResponse {
    message: {
        // This is the actual notification data, as base64url-encoded JSON.
        data: string
        // This is a Cloud Pub/Sub message id, unrelated to Gmail messages.
        message_id: string
    },
    // "projects/myproject/subscriptions/mysubscription"
    subscription: string
}

interface DecodedGmailWatchHookResponseMessage {
    emailAddress: string
    historyId: string
}

// const gmailConnectedAppCache: {
//     [email: string]: IConnectedApp
// } = {};

export function hookRoutes() {
    const router = express.Router();

    // Gmail pub sub watch
    router.post('/gmail/incoming', (req, res) => {
        // https://developers.google.com/gmail/api/guides/push
        // Note - the user has to login and look at their gmail every 7 days in order to call Watch.
        // If they don't, this hook won't happen for them. We could do it automatically, eventually.

        try {
            let body: GmailWatchHookResponse = req.body;
            let messageData = body.message.data;
            let decodedMessageJson: string = PlateUtil.decodeBase64(messageData);
            let decodedMessage: DecodedGmailWatchHookResponseMessage = JSON.parse(decodedMessageJson);
            const emailAddress = decodedMessage.emailAddress;
            const historyId = decodedMessage.historyId;

            // TODO - Cache this soon - concern is that do the models update live?
            ConnectedApp.getGmailConnectedAppsByEmail(emailAddress).then((connectedApps) => {
                if (connectedApps && connectedApps.length) {
                    // Here - first see if they have automation rules. Then if it's socket. If it's either, get the gmail with a static method on the client.
                    // Then call the socket method if needed, and then create the automation.

                    let needSendSocket = false;
                    let hasAutomationRules = false;
                    // First see if we should send a socket event.
                    if (socketController.getShouldSendGmailConnectedAppEvent(connectedApps)) {
                        needSendSocket = true;
                    }

                    // Then see if there are automation rules to send.
                    for (let connectedApp of connectedApps) {
                        if (connectedApp.automationRules && connectedApp.automationRules.length) {
                            hasAutomationRules = true;
                            break;
                        }
                    }

                    if (needSendSocket || hasAutomationRules) {
                        // The connected apps should all have the same access token, so just use the first one
                        GmailClientStatic.getEmailsFromHistoryId(connectedApps[0], historyId).then((messages: gapi.client.gmail.Message[]) => {
                            if (messages && messages.length) {
                                if (needSendSocket) {
                                    socketController.serverEventGmailNewMessagesFromWatch(connectedApps, messages);
                                }
                                if (hasAutomationRules) {
                                    for (let connectedApp of connectedApps) {
                                        if (connectedApp.automationRules && connectedApp.automationRules.length) {
                                            connectedApp.processGmailAutomationRule(messages);
                                        }
                                    }
                                }
                            }
                        }).catch((reason) => {
                            console.error(reason);
                        });
                    }
                }
            }).catch((reason) => {
                console.error(reason);
            })

            //  If using webhook delivery, then responding successfully (e.g. HTTP 200) will acknowledge it.
            res.sendStatus(200);
        } catch (e) {
            console.error(e);
        }

    });

    return router;
}












