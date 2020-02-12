import * as mongoose from "mongoose";
import * as Q from "q";

import { Config } from '../config/config-service';
import {IUser, IUserStatic, ISimpleUser, IUserTeamReference} from "./users";
import {PlateUtil} from "../util/plate-util";
import {Resource} from "../resources/resource-service";
import {IConnectedApp} from "./connectedapps";

// This may as well be called GmailConnectedAppItem
// Although Slack will be pretty similar

export interface ISimpleConnectedAppItem {
    id: string,
    title: string,
    owner: string,
    subtitle: string,
    text: string,
    connectedId: string,
    connectedAppId: string,
    created: number
}
export interface IConnectedAppItem extends mongoose.Document {
    id: string,
    title: string,
    owner: string,
    subtitle: string,
    text: string,
    connectedId: string,
    connectedAppId: string,
    created: number
}

export interface IConnectedAppItemStatic extends mongoose.Model<IConnectedAppItem> {}

let ConnectedAppItemSchema = new mongoose.Schema({
    connectedAppId: String,
    connectedId: String,
    text: String,
    subtitle: String,
    title: String,
    owner: mongoose.Schema.Types.ObjectId,
    created: {
        type: Date,
        default: Date.now
    }
});

export interface IConnectedAppItemStatic{ verifyParameters(body: any): string }
ConnectedAppItemSchema.statics.verifyParameters = function(body: any): string {
    return null;
}

export interface IConnectedAppItemStatic{ newConnectedAppItemForUser(newConnectedAppItemBody: ISimpleConnectedAppItem, connectedApp: IConnectedApp, user: IUser): Q.Promise<IConnectedAppItem> }
ConnectedAppItemSchema.statics.newConnectedAppItemForUser = function(newConnectedAppItemBody: ISimpleConnectedAppItem, connectedApp: IConnectedApp, user: IUser): Q.Promise<IConnectedAppItem> {
    let deferred = Q.defer<IConnectedAppItem>();

    let newConnectedAppItem = new ConnectedAppItem();
    newConnectedAppItem.title = newConnectedAppItemBody.title;
    newConnectedAppItem.subtitle = newConnectedAppItemBody.subtitle;
    newConnectedAppItem.text = newConnectedAppItemBody.text;
    newConnectedAppItem.connectedId = newConnectedAppItemBody.connectedId;
    newConnectedAppItem.connectedAppId = connectedApp.id;
    newConnectedAppItem.owner = user.id;

    newConnectedAppItem.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(newConnectedAppItem);
        }
    })

    return deferred.promise;
}

export interface IConnectedAppItemStatic{ getItemsForConnectedApp(connectedApp: IConnectedApp): Q.Promise<IConnectedAppItem[]> }
ConnectedAppItemSchema.statics.getItemsForConnectedApp = function(connectedApp: IConnectedApp): Q.Promise<IConnectedAppItem[]> {
    let deferred = Q.defer<IConnectedAppItem[]>();

    ConnectedAppItem.find({
        connectedAppId: connectedApp.id
    }, function(err, items) {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(items);
        }
    })

    return deferred.promise;
}

export interface IConnectedAppItem{ simple      (): ISimpleConnectedAppItem }
ConnectedAppItemSchema.methods.simple = function(): ISimpleConnectedAppItem {
    let thisConnectedApp: IConnectedAppItem = this;
    return {
        id: thisConnectedApp.id,
        owner: thisConnectedApp.owner,
        title: thisConnectedApp.title,
        subtitle: thisConnectedApp.subtitle,
        text: thisConnectedApp.text,
        connectedId: thisConnectedApp.connectedId,
        connectedAppId: thisConnectedApp.connectedAppId,
        created: thisConnectedApp.created
    }
}

mongoose.model('ConnectedAppItem', ConnectedAppItemSchema);
export const ConnectedAppItem: IConnectedAppItemStatic = <IConnectedAppItemStatic>mongoose.model('ConnectedAppItem');














