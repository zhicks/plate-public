import * as mongoose from "mongoose";
import * as Q from "q";
import {IPlateItem} from "./plate-item";
import {IUser} from "./users";

export interface IPlateItemCommentStatic extends mongoose.Model<IPlateItemComment> {
}

export interface IPlateItemComment extends mongoose.Document {
    modified: number;
    created: number;
    content: string;
    owner: string;
    ownerName: string;
    item: string;
    archived: boolean;
}

export interface ISimplePlateItemComment {
    id: string;
    modified: number;
    created: number;
    content: string;
    ownerName: string;
    owner: string;
    item: string;
    archived: boolean;
}

let PlateItemCommentSchema = new mongoose.Schema({
    content: String,
    item: mongoose.Schema.Types.ObjectId,
    owner: mongoose.Schema.Types.ObjectId,
    ownerName: String,
    archived: {
        type: Boolean,
        default: false
    },
    modified: {
        type: Date,
        default: Date.now
    },
    created: {
        type: Date,
        default: Date.now
    }
});
// ------------------------------------------------------------------- Statics
export interface IPlateItemCommentStatic{ VerifyParameters(object: ISimplePlateItemComment): string }
PlateItemCommentSchema.statics.VerifyParameters = function(object: ISimplePlateItemComment): string {
    return null;
}

export interface IPlateItemCommentStatic{ getCommentsForPlateItem(plateItem: IPlateItem, user: IUser): Q.Promise<IPlateItemComment[]> }
PlateItemCommentSchema.statics.getCommentsForPlateItem = function(plateItem: IPlateItem, user: IUser): Q.Promise<IPlateItemComment[]> {
    let deferred = Q.defer<IPlateItemComment[]>();

    PlateItemComment.find({
        item: plateItem.id,
        archived: {
            $ne: true
        }
    }, (err, comments) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(comments);
        }
    })

    return deferred.promise;
}

export interface IPlateItemCommentStatic{ newCommentForPlateItem(plateItem: IPlateItem, user: IUser, commentDetails: ISimplePlateItemComment): Q.Promise<IPlateItemComment> }
PlateItemCommentSchema.statics.newCommentForPlateItem = function(plateItem: IPlateItem, user: IUser, commentDetails: ISimplePlateItemComment): Q.Promise<IPlateItemComment> {
    let deferred = Q.defer<IPlateItemComment>();

    let comment = new PlateItemComment();
    comment.item = plateItem.id;
    comment.owner = user.id;
    comment.content = commentDetails.content;
    comment.ownerName = commentDetails.ownerName;

    comment.save((err) => {
        if (err) {
        	deferred.reject(err);
        } else {
            plateItem.numComments++;
            plateItem.save((err) => {
                if (err) {
                    deferred.resolve(err);
                } else {
                    deferred.resolve(comment);
                }
            })
        }
    })

    return deferred.promise;
}

export interface IPlateItemCommentStatic{ findByIdForPlateItem(commentId: string, plateItem: IPlateItem, user: IUser): Q.Promise<IPlateItemComment> }
PlateItemCommentSchema.statics.findByIdForPlateItem = function(commentId: string, plateItem: IPlateItem, user: IUser): Q.Promise<IPlateItemComment> {
    let deferred = Q.defer<IPlateItemComment>();

    PlateItemComment.findOne({
        '_id': commentId,
        item: plateItem.id
    }, (err, comment) => {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(comment);
        }
    });

    return deferred.promise;
}

// ------------------------------------------------------------------- Methods
export interface IPlateItemComment{ updateComment      (newDetails: ISimplePlateItemComment, user: IUser, plateItem: IPlateItem): Q.Promise<IPlateItemComment> }
PlateItemCommentSchema.methods.updateComment = function(newDetails: ISimplePlateItemComment, user: IUser, plateItem: IPlateItem): Q.Promise<IPlateItemComment> {
    let deferred = Q.defer<IPlateItemComment>();

    let thisComment: IPlateItemComment = this;

    let somethingChanged = false;
    if (newDetails.content) {
        if (thisComment.content !== newDetails.content) {
            thisComment.content = newDetails.content;
            somethingChanged = true;
        }
    }

    let commentRemoved = false;
    if (newDetails.archived) {
        if (thisComment.archived !== newDetails.archived) {
            thisComment.archived = newDetails.archived;
            somethingChanged = true;
            commentRemoved = true;
        }
    }

    if (somethingChanged) {
        thisComment.modified = Date.now();
        thisComment.save((err) => {
            if (err) {
            	deferred.reject(err);
            } else {
                if (!commentRemoved) {
                    deferred.resolve(thisComment);
                } else {
                    plateItem.numComments--;
                    plateItem.save((err) => {
                        if (err) {
                        	deferred.reject(err);
                        } else {
                            deferred.resolve(thisComment);
                        }
                    })
                }
            }
        })
    }

    return deferred.promise;
}

export interface IPlateItemComment{ simple      (): ISimplePlateItemComment }
PlateItemCommentSchema.methods.simple = function(): ISimplePlateItemComment {
    return {
        id: this.id,
        created: this.created,
        modified: this.modified,
        content: this.content,
        owner: this.owner,
        item: this.item,
        ownerName: this.ownerName,
        archived: this.archived
    }
}

mongoose.model('PlateItemComment', PlateItemCommentSchema);

export const PlateItemComment: IPlateItemCommentStatic = <IPlateItemCommentStatic>mongoose.model('PlateItemComment');















