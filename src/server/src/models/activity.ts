import * as mongoose from "mongoose";
import * as Q from "q";
import {IUser} from "./users";
import {socketController} from "../socket/socket-controller";
import {IPlatter} from "./platters";

/*
Item:
  Zack Hicks edited "Asfadafs..." in "Fsdafsdf"
  Zack Hicks created "asdfsdf..." in "asdfasf"
  Zack Hicks moved "asfasdf..." to "asdfasdf" ("a private plate")
  Zack Hicks marked "adsff" as Done in "asdasf"
  Zack Hicks attached a Gmail to "asdff" in "asdfdfs" (gmail content)
  Zack Hicks archived "asfsf" in "asfadsf"
  Zack Hicks made a due date for "asdf" in "asdfdsf" (due date)
 no: - Zack Hicks changed the Platter team "asdfsf"
 no: - Zack Hicks changed the plate color "asfsf"
  Zack Hicks created a new Platter "asdfadfs"
 - Zack Hicks changed "Priority" to 5 for "asfsdf"
 - Zack Hicks invited a new team member "asfsdf"
 - Zack Hicks changed the header "asfdsf" to 'asdfasdf" in "asdfdfs"
 - Zack Hicks added a comment to "asfsdf" in "asdfasf" (comment)
 */

export const NORMAL_MAX_RETRIEVAL_AMOUNT = 100;
const MAX_ITEM_LENGTH_FOR_ACTIVITY = 50;

export enum ServerActivityActionType {
    CreatePlateItem,
    EditPlateItemTitle,
    ArchivePlateItem,
    MovePlateItem,
    MarkAsDonePlateItem,
    AttachGmail,
    AttachSlack,
    CreateDueDate,
    ChangeDueDate,
    CreatePlatter,
    ChangePlateItemMetric,
    InviteTeamMember,
    ChangePlateHeader,
    CreateComment,
    EditComment,
    RemoveDueDate,
    NewHeader,
    RemoveHeader,
    UserJoinedTeam,
    RemoveFileAttachment,
    AddFileAttachment,
    PlateMovedPlatters
}

export interface IActivityStatic extends mongoose.Model<IActivity> {
}

export interface IActivity extends mongoose.Document {
    id: string
    created: number
    originator: string
    originatorName: string
    team: string
    activityActionType: ServerActivityActionType
    specificMembers: string[]
    item: string
    acknowledgedBy: string[]
    detail1: string
    detail2: string
    detail3: string
    color: string
    plate: string
    platter: string
}

export interface ISimpleActivity {
    id: string
    created: number
    originator: string
    originatorName: string
    team: string
    activityActionType: ServerActivityActionType
    specificMembers: string[]
    item: string
    acknowledgedBy: string[]
    detail1: string
    detail2: string
    detail3: string
    color: string
    plate: string
    platter: string
}

let ActivitySchema = new mongoose.Schema({
    originator: mongoose.Schema.Types.ObjectId,
    acknowledgedBy: [mongoose.Schema.Types.ObjectId],
    specificMembers: [mongoose.Schema.Types.ObjectId],
    item: mongoose.Schema.Types.ObjectId,
    team: mongoose.Schema.Types.ObjectId,
    activityActionType: Number,
    originatorName: String,
    plate: String,
    platter: String,
    detail1: String,
    detail2: String,
    detail3: String,
    color: String,
    created: {
        type: Date,
        default: Date.now
    }
});
// ------------------------------------------------------------------- Statics
export interface IActivityStatic{ VerifyParameters(object: ISimpleActivity): string }
ActivitySchema.statics.VerifyParameters = function(object: ISimpleActivity): string {
    return null;
}

export interface IActivityStatic{ createActivity(plateId: string, platter: IPlatter, originator: IUser, itemId: string, teamId: string, activityActionType: ServerActivityActionType, color: string, detail1: string, detail2?: string, detail3?: string): Q.Promise<IActivity> }
ActivitySchema.statics.createActivity = function(plateId: string, platter: IPlatter, originator: IUser, itemId: string, teamId: string, activityActionType: ServerActivityActionType, color: string, detail1: string, detail2?: string, detail3?: string): Q.Promise<IActivity> {
    let deferred = Q.defer<IActivity>();

    let activity = new Activity();
    activity.acknowledgedBy.push(originator.id);
    activity.originator = originator.id;
    activity.originatorName = originator.name;
    activity.item = itemId;
    activity.team = teamId;
    if (platter && platter.plateBusiness.inviteOnly && platter.plateBusiness.members.length) {
        activity.specificMembers = platter.plateBusiness.members;
    }
    activity.activityActionType = activityActionType;
    activity.detail1 = detail1 && detail1.substring(0, MAX_ITEM_LENGTH_FOR_ACTIVITY) || '';
    activity.detail2 = detail2;
    activity.detail3 = detail3;
    activity.color = color;
    activity.plate = plateId;
    activity.platter = platter && platter.id;

    activity.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(activity);
            socketController.serverEventActivityCreated(originator, activity, activity.specificMembers);
        }
    })

    return deferred.promise;
}

export interface IActivityStatic{ getForUser(user: IUser, amount?: number): Q.Promise<IActivity[]> }
ActivitySchema.statics.getForUser = function(user: IUser, amount = NORMAL_MAX_RETRIEVAL_AMOUNT): Q.Promise<IActivity[]> {
    let deferred = Q.defer<IActivity[]>();

    let teamIdsArray = user.getTeamIds();
    Activity.find({
        $or: [
            {
                team: { $in: teamIdsArray },
                specificMembers: null
            },
            {
                originator: user.id
            },
            // TODO: I have a feeling this is not optimal.
            {
                // Invite only members
                team: { $in: teamIdsArray },
                specificMembers: user.id
            }
        ]
    })
        .limit(amount)
        .sort({created: -1})
        .exec((err, activities) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(activities);
            }
        })

    return deferred.promise;
}

export interface IActivityStatic{ getForItemId(user: IUser, itemId: string, amount?: number): Q.Promise<IActivity[]> }
ActivitySchema.statics.getForItemId = function(user: IUser, itemId: string, amount = NORMAL_MAX_RETRIEVAL_AMOUNT): Q.Promise<IActivity[]> {
    let deferred = Q.defer<IActivity[]>();

    Activity.find({
        item: itemId
    })
        .limit(amount)
        .sort({created: -1})
        .exec((err, activities) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(activities);
            }
        })

    return deferred.promise;
}

export interface IActivityStatic{ simpleArray(activities: IActivity[]): ISimpleActivity[] }
ActivitySchema.statics.simpleArray = function(activities: IActivity[]): ISimpleActivity[] {
    let simple: ISimpleActivity[] = [];
    for (let activity of activities) {
        simple.push(activity.simple());
    }
    return simple;
}

export interface IActivityStatic{ acknowledge      (id: string, user: IUser): Q.Promise<IActivity> }
ActivitySchema.statics.acknowledge = function(id: string, user: IUser): Q.Promise<IActivity> {
    let deferred = Q.defer<IActivity>();

    if (!id) {
        deferred.reject('no id given for acknowledge activity');
    } else {
        let teamIdsArray = user.getTeamIds();
        Activity.update(
            {
                '_id': id,
                $or: [
                    {
                        team: { $in: teamIdsArray }
                    },
                    {
                        originator: user.id
                    }
                ]
            },
            {
                $addToSet: {
                    acknowledgedBy: user.id
                }
            })
            .exec((err, something) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(something);
                }
            });
    }

    return deferred.promise;
}

// ------------------------------------------------------------------- Methods

export interface IActivity{ simple      (): ISimpleActivity }
ActivitySchema.methods.simple = function(): ISimpleActivity {
    let thisActivity: IActivity = this;
    return {
        id: thisActivity.id,
        created: thisActivity.created,
        originator: thisActivity.originator,
        originatorName: thisActivity.originatorName,
        team: thisActivity.team,
        activityActionType: thisActivity.activityActionType,
        item: thisActivity.item,
        detail1: thisActivity.detail1,
        detail2: thisActivity.detail2,
        detail3: thisActivity.detail3,
        acknowledgedBy: thisActivity.acknowledgedBy,
        color: thisActivity.color,
        plate: thisActivity.plate,
        platter: thisActivity.platter,
        specificMembers: thisActivity.specificMembers
    }
}

mongoose.model('Activity', ActivitySchema);

export const Activity: IActivityStatic = <IActivityStatic>mongoose.model('Activity');















