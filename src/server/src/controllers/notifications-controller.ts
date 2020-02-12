import {IUser} from "../models/users";
import {INotification, INotificationStatic} from "../models/notifications";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import * as mongoose from "mongoose";
import {Resource} from "../resources/resource-service";
const Notification: INotificationStatic = <INotificationStatic>mongoose.model('Notification');

class NotificationsController extends BaseController {

    get(req, res) {
        super.verifyUserLoggedIn(req, res, 'Notifications get').then((user: IUser) => {
            const notificationToGet = req.params.id;
            if (notificationToGet) {
                Notification.GetByIdForUser(notificationToGet, user).then((notification) => {
                    res.send(notification.simple);
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for notification');
                });
            } else {
                Notification.GetForUser(user).then((notifications) => {
                    let simpleNotifications = [];
                    for (let notification of notifications) {
                        simpleNotifications.push(notification.simple());
                    }
                    res.send(simpleNotifications);
                }).catch(Config.HandleServerSideError);
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    markSeen(req, res) {
        const notificationToGet = req.params.id;
        if (!notificationToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
        } else {
            super.verifyUserLoggedIn(req, res, 'Notifications get').then((user: IUser) => {
                Notification.GetByIdForUser(notificationToGet, user).then((notification) => {
                    notification.markSeen().then((notification) => {
                        res.sendStatus(200);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError(reason);
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for notification');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    acknowledge(req, res) {
        const notificationToGet = req.params.id;
        if (!notificationToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
        } else {
            super.verifyUserLoggedIn(req, res, 'Notifications get').then((user: IUser) => {
                Notification.GetByIdForUser(notificationToGet, user).then((notification) => {
                    notification.acknowledge().then((notification) => {
                        res.sendStatus(200);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError(reason);
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for notification');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

}

export const notificationsController = new NotificationsController();