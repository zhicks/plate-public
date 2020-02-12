import * as mongoose from "mongoose";
import * as Q from "q";
import {Config} from "../config/config-service";
import {IUser} from "./users";
import {ITeam} from "./teams";
import {Resource} from "../resources/resource-service";
import {PlateUtil} from "../util/plate-util";
import {IPlateItem} from "./plate-item";
import {socketController} from "../socket/socket-controller";

export interface INotificationStatic extends mongoose.Model<INotification> {
    GetForUser(user: IUser, live?: boolean): Q.Promise<INotification[]>;
    GetByIdForUser(id: string, user: IUser): Q.Promise<INotification>;
    VerifyParameters(object: ISimpleNotification): string;
}

export enum ServerNotificationType {
    TeamInvite,
    ItemDueSoon
}

export interface INotification extends mongoose.Document {
    id: string;
    userId: string;
    userEmailIfNoId: string; // Gets resolved when user first registers
    message: string;
    notificationType: ServerNotificationType;
    messageType: number;
    live: boolean; // acknowledged is the correct name
    seen: boolean;
    link: string; // DEPRECATED. Use itemId instead
    itemId: string;
    extra: string;
    time: Date;
    simple: () => ISimpleNotification;
}

export interface ISimpleNotification {
    id: string;
    userId: string;
    message: string;
    notificationType: ServerNotificationType;
    live: boolean; // acknowledged is the correct name
    seen: boolean;
    itemId: string;
    extra: string;
    link: string; // DEPRECATED. Use itemId instead
    time: Date;
}

let NotificationSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    message: String,
    extra: String,
    notificationType: Number,
    userEmailIfNoId: String,
    itemId: String,
    live: {
        type: Boolean,
        default: true
    },
    seen: {
        type: Boolean,
        default: false
    },
    link: String, // DEPRECATED. Use itemId instead
    time : {
        type: Date,
        default: Date.now
    }
});

// ------------------------------------ Utility

// Relative to /p.
class NotificationLinks {
    static TeamPage = '/settings/team';
}

// ------------------------------------ Statics

NotificationSchema.statics.VerifyParameters = function(object: ISimpleNotification): string {
    // TODO - Nice to have for users of the API one day
    return null;
}

export interface INotificationStatic{ NewNotificationInviteForTeam(user: IUser, toNotify: IUser, team: ITeam): Q.Promise<INotification> }
NotificationSchema.statics.NewNotificationInviteForTeam = function(user: IUser, toNotify: IUser, team: ITeam): Q.Promise<INotification> {
    let deferred = Q.defer<INotification>();
    let notification = new Notification();
    notification.message = Resource.Make(Resource.Translatable.NOTIFICATION_InviteForTeam, user.email, team.name);
    notification.userId = toNotify.id;
    notification.link = NotificationLinks.TeamPage;
    notification.notificationType = ServerNotificationType.TeamInvite;
    notification.save((err) => {
        if (err) {
        	console.error('error in saving notification for team invite');
        } else {
            socketController.serverEventNewNotification(notification);
        }
    });
    return deferred.promise;
}

export interface INotificationStatic{ newNotificationInviteForTeamUserDoesNotExist(inviter: IUser, inviteeEmail: string, team: ITeam): Q.Promise<INotification> }
NotificationSchema.statics.newNotificationInviteForTeamUserDoesNotExist = function(inviter: IUser, inviteeEmail: string, team: ITeam): Q.Promise<INotification> {
    let deferred = Q.defer<INotification>();
    let notification = new Notification();
    notification.message = Resource.Make(Resource.Translatable.NOTIFICATION_InviteForTeam, inviter.email, team.name);
    notification.userEmailIfNoId = inviteeEmail;
    notification.link = NotificationLinks.TeamPage;
    notification.notificationType = ServerNotificationType.TeamInvite;
    notification.save((err) => {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(notification);
        }
    })
    return deferred.promise;
}

NotificationSchema.statics.GetForUser = function(user: IUser, live?: boolean): Q.Promise<INotification[]> {
    let deferred = Q.defer<INotification[]>();
    let params: any = {
        userId: user.id
    }
    if (live !== undefined) {
        params.live = live;
    }
    Notification.find(params)
        .limit(15)
        .exec((err, notifications) => {
            if (err) {
                deferred.reject(err);
                Config.HandleServerSideError('Error in get notifications for user');
            } else {
                deferred.resolve(notifications);
            }
        });
    return deferred.promise;
}

/**
 * If this user has been invited by email when they did not exist, creates a notification for them.
 */
export interface INotificationStatic{ resolveInvitesForEmail(user: IUser): Q.Promise<INotification[]> }
NotificationSchema.statics.resolveInvitesForEmail = function(user: IUser): Q.Promise<INotification[]> {
    let deferred = Q.defer<INotification[]>();
    Notification.find({
        userEmailIfNoId: user.email
    }, (err, notifications) => {
        if (err) {
        	deferred.reject(err);
        } else {
            if (notifications && notifications.length) {
                let notificationsSaved = 0;
                for (let notification of notifications) {
                    notification.userId = user.id;
                    delete notification.userEmailIfNoId;
                    notification.save((err) => {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            notificationsSaved++;
                            if (notificationsSaved >= notifications.length) {
                                deferred.resolve(notifications);
                            }
                        }
                    })
                }
            } else {
                deferred.resolve([]);
            }
        }
    });
    return deferred.promise;
}

NotificationSchema.statics.GetByIdForUser = function(id: string, user: IUser): Q.Promise<INotification> {
    let deferred = Q.defer<INotification>();
    Notification.findById(id, function(err, notification) {
        if (err) {
            deferred.reject(err);
            Config.HandleServerSideError('Error in get notifications for user');
        } else {
            // TODO - Considerations for ObjectID vs string
            if (notification.userId.toString() !== user.id) {
                const reason = 'User not authorized for notification';
                deferred.reject(reason);
                Config.HandleServerSideError(reason);
            } else {
                deferred.resolve(notification);
            }
        }
    })
    return deferred.promise;
}

export interface INotificationStatic{ notifyPlateItemDue(plateItem: IPlateItem): void }
NotificationSchema.statics.notifyPlateItemDue = function(plateItem: IPlateItem): void {

    // for (let userId of plateItem.assignedTo...) VERY SOON - get all assigned users for plate item
    // First see if there is a live notification for the item already
    // If it has been acked, it won't be live and we can remind again
    Notification.find({
        userId: plateItem.owner,
        notificationType: ServerNotificationType.ItemDueSoon,
        itemId: plateItem.id,
        seen: false
    }).exec((err, notifications) => {
        if (err) {
            console.error('error in getting live notifications for user for due date');
        } else {
            if (notifications && notifications.length) {
                // Do nothing
            } else {
                let notification = new Notification();
                notification.userId = plateItem.owner;
                notification.notificationType = ServerNotificationType.ItemDueSoon;
                notification.itemId = plateItem.id;
                notification.message = plateItem.title;
                notification.extra = '' + plateItem.due;

                notification.save((err) => {
                    if (err) {
                        console.error('error in saving notification!');
                    } else {
                        socketController.serverEventNewNotification(notification);
                    }
                })
            }
        }
    });
}

// ------------------------------------ Instance

export interface INotification{ markSeen(): Q.Promise<INotification> }
NotificationSchema.methods.markSeen = function(): Q.Promise<INotification> {
    let deferred = Q.defer<INotification>();
    let thisNotification: INotification = this;
    if (thisNotification.seen !== true) {
        thisNotification.seen = true;
        thisNotification.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisNotification);
            }
        });
    } else {
        deferred.resolve(thisNotification);
    }
    return deferred.promise;
}
export interface INotification{ acknowledge(): Q.Promise<INotification> }
NotificationSchema.methods.acknowledge = function(): Q.Promise<INotification> {
    let deferred = Q.defer<INotification>();
    let thisNotification: INotification = this;
    if (thisNotification.live !== false) {
        thisNotification.live = false;
        thisNotification.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisNotification);
            }
        });
    } else {
        deferred.resolve(thisNotification);
    }
    return deferred.promise;
}

NotificationSchema.methods.simple = function(): ISimpleNotification {
    let thisNotification: INotification = this;
    return {
        id: thisNotification.id,
        userId: thisNotification.userId,
        message: thisNotification.message,
        live: thisNotification.live,
        link: thisNotification.link,
        time: thisNotification.time,
        notificationType: thisNotification.notificationType,
        itemId: thisNotification.itemId,
        seen: thisNotification.seen,
        extra: thisNotification.extra
    }
}

mongoose.model('Notification', NotificationSchema);

export const Notification: INotificationStatic = <INotificationStatic>mongoose.model('Notification');















