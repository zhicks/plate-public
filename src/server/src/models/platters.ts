import * as mongoose from "mongoose";
import * as Q from "q";
import {IUser, IUserTeamReference} from "./users";
import {ITeam, Team, PermissionUserType, PERMISSION_KEYS} from "./teams";
import {Resource} from "../resources/resource-service";
import {Activity, ServerActivityActionType} from "./activity";
import {IPlatePermissions, Plate} from "./plates";

const VALIDATION = {
    NameLength: 100,
    ColorLength: 30
}

export interface IPlatterStatic extends mongoose.Model<IPlatter> {
}

export interface IPlatterPlateBusiness {
    inviteOnly: boolean;
    members: string[];
    permissions: IPlatterPermissions;
}

export interface IPlatterPermissions extends IPlatePermissions {
    cPlts: PermissionUserType,
    mPlts: PermissionUserType,
    aPlts: PermissionUserType
}

export interface IPlatter extends mongoose.Document {
    id?: string;
    name: string;
    owner: string;
    expanded: boolean;
    team: string;
    color: string;
    modified: number;
    created: number;
    archived: boolean;
    plateBusiness: IPlatterPlateBusiness;
}

export interface ISimplePlatter {
    name: string;
    id: string;
    owner: string;
    expanded: boolean;
    team: string;
    color: string;
    modified: number;
    created: number;
    archived: boolean;
    plateBusiness: IPlatterPlateBusiness; // No need for simple - yet
}

let PlatterSchema = new mongoose.Schema({
    name: String,
    owner: mongoose.Schema.Types.ObjectId,
    team: mongoose.Schema.Types.ObjectId,
    plateBusiness: {
        inviteOnly: Boolean,
        members: [mongoose.Schema.Types.ObjectId],
        permissions: {
            cPlts: Number,
            mPlts: Number,
            aPlts: Number,
            cPltIms: Number,
            mPltIms: Number,
            moveImToDiff: Number,
            aPltIms: Number
        }
    },
    color: {
        type: String,
        default: '#0066CC'
    },
    expanded: {
        type: Boolean,
        default: true
    },
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
export interface IPlatterStatic{ VerifyParameters(object: ISimplePlatter): string }
PlatterSchema.statics.VerifyParameters = function(object: ISimplePlatter): string {
    return null;
}

export interface IPlatterStatic{ getAllForUser(user: IUser, excludeTeams?: boolean, justIds?: boolean): Q.Promise<IPlatter[]> }
PlatterSchema.statics.getAllForUser = function(user: IUser, excludeTeams?: boolean, justIds?: boolean): Q.Promise<IPlatter[]> {
    let deferred = Q.defer<IPlatter[]>();
    let teamIdsArray = user.getTeamIds();
    let findObject: any = {
        $or: [
            {
                // Any personal plate
                owner: user.id,
                team: null
            },
            {
                // Any team that the user is a part of that's not invite only
                team: { $in: teamIdsArray },
                'plateBusiness.inviteOnly': {
                    $ne: true
                }
            },
            // TODO: I have a feeling this is not optimal.
            {
                // Invite only members
                team: { $in: teamIdsArray },
                'plateBusiness.inviteOnly': true,
                'plateBusiness.members': user.id
            }
        ],
        archived: {
            $ne: true
        }
    }
    if (excludeTeams) {
        findObject = {
            owner: user.id,
            team: {
                $eq: null
            },
            archived: {
                $ne: true
            }
        }
    }
    if (justIds) {
        Platter.find(findObject).select('_id').exec((err, platterIds) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(platterIds);
            }
        });
    } else {
        Platter.find(findObject, (err, platters) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(platters);
            }
        });
    }

    return deferred.promise;
}

export interface IPlatterStatic{ getByIdForUser(id: string, user: IUser): Q.Promise<IPlatter> }
PlatterSchema.statics.getByIdForUser = function(id: string, user: IUser): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    if (!id) {
        deferred.resolve(null);
    } else {
        Platter.findById(id, function(err, platter) {
            if (!platter) {
                deferred.reject('Platter does not exist');
            } else {
                if (!platter.doesUserHaveAccess(user)) {
                    deferred.reject('User doesn\'t have permission for platter');
                } else {
                    deferred.resolve(platter);
                }
            }
        });
    }
    return deferred.promise;
}

// Note - this is currently only used in assignGenericPlatterToPlates
export interface IPlatterStatic{ getAllForTeam(team: ITeam, archived?: boolean): Q.Promise<IPlatter[]> }
PlatterSchema.statics.getAllForTeam = function(team: ITeam, archived: boolean = true): Q.Promise<IPlatter[]> {
    let deferred = Q.defer<IPlatter[]>();
    let findObject: any = {
        team: team.id,
        archived: {
            $ne: archived
        }
    }
    Platter.find(findObject, (err, platters) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(platters);
        }
    });
    return deferred.promise;
}

export interface IPlatterStatic{ createPlatterFromNameOnly(user: IUser, name: string, color?: string, team?: ITeam, ownerFromMigratingPlate?: string): Q.Promise<IPlatter> }
PlatterSchema.statics.createPlatterFromNameOnly = function(user: IUser, name: string, color?: string, team?: ITeam, ownerFromMigratingPlate?: string): Q.Promise<IPlatter> {
    return Platter.newPlatter(user, <any>{name: name});
}

export interface IPlatterStatic{ newPlatter(user: IUser, platterInfo: ISimplePlatter, color?: string, team?: ITeam, ownerFromMigratingPlate?: string): Q.Promise<IPlatter> }
PlatterSchema.statics.newPlatter = function(user: IUser, platterInfo: ISimplePlatter, color?: string, team?: ITeam, ownerFromMigratingPlate?: string): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();

    let hasPermission = false;
    if (!team) {
        hasPermission = true;
    } else if (team.checkPermission(user, PERMISSION_KEYS.CREATE_PLATTERS, false)) {
        hasPermission = true;
    }

    if (!hasPermission) {
        deferred.reject('User does not have permission to create Platters')
    } else {
        let name = platterInfo.name;
        let valid = true;
        if (!name || name.length > VALIDATION.NameLength) {
            deferred.reject('Name too long');
            valid = false;
        }
        if (color && color.length > VALIDATION.ColorLength) {
            deferred.reject('Color invalid');
            valid = false;
        }

        if (valid) {
            let platter = new Platter();
            platter.name = name;

            if (color) {
                platter.color = color;
            }

            if (team) {
                platter.team = team.id;
                let plateBusinessObj = platterInfo.plateBusiness;
                applyPlateBusinessChangesToPlatterIfApplicable(platter, plateBusinessObj, team);
                if (!color) {
                    platter.color = team.color;
                }
            }

            if (!ownerFromMigratingPlate) {
                platter.owner = user.id;
            } else {
                platter.owner = ownerFromMigratingPlate;
            }

            platter.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(platter);
                    Activity.createActivity(null, platter, user, platter.id, platter.team, ServerActivityActionType.CreatePlatter, platter.color, platter.name, platter.team);
                }
            });
        }
    }

    return deferred.promise;
}

export interface IPlatterStatic{ createDefaultPlatter(user: IUser): Q.Promise<IPlatter> }
PlatterSchema.statics.createDefaultPlatter = function(user: IUser): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();

    let newName = Resource.Translatable.DEFAULTS_PLATTER_NAME;
    Platter.createPlatterFromNameOnly(user, newName).then((platter) => {
        deferred.resolve(platter);
    }).catch((reason) => {
        deferred.reject(reason);
    });

    return deferred.promise;
}

export interface IPlatterStatic{ changeOwnershipForTeamRemoval(team: ITeam, userThatWasRemovedFromTeam: IUser): Q.Promise<number> }
PlatterSchema.statics.changeOwnershipForTeamRemoval = function(team: ITeam, userThatWasRemovedFromTeam: IUser): Q.Promise<number> {
    let deferred = Q.defer<number>();

    let details: any = {
        team: team.id,
        owner: userThatWasRemovedFromTeam.id
    }
    Platter.update(
        details,
        {
            $set: { owner: team.owner }
        },
        {
            multi: true
        },
        (err, num) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(num);
            }
        }
    )

    return deferred.promise;
}

function isValidPermission(permission: PermissionUserType) {
    let valid = permission === PermissionUserType.Regular ||
        permission === PermissionUserType.Admin ||
        permission === PermissionUserType.Owner;
    return valid;
}
/**
 * Does not save.
 * @param platter
 * @param plateBusinessObj
 * @param team
 */
function applyPlateBusinessChangesToPlatterIfApplicable(platter: IPlatter, plateBusinessObj: IPlatterPlateBusiness, team: ITeam) {
    if (plateBusinessObj && Team.getIsPlateBusiness(team)) {
        if (plateBusinessObj.inviteOnly === true || plateBusinessObj.inviteOnly === false) {
            platter.plateBusiness.inviteOnly = plateBusinessObj.inviteOnly;
        }
        if (plateBusinessObj.members) {
            platter.plateBusiness.members = plateBusinessObj.members;
        }
        let permissions = plateBusinessObj.permissions;
        if (permissions) {
            if (isValidPermission(permissions.cPlts)) {
                platter.plateBusiness.permissions.cPlts = permissions.cPlts;
            }
            if (isValidPermission(permissions.mPlts)) {
                platter.plateBusiness.permissions.mPlts = permissions.mPlts;
            }
            if (isValidPermission(permissions.aPlts)) {
                platter.plateBusiness.permissions.aPlts = permissions.aPlts;
            }
            if (isValidPermission(permissions.cPltIms)) {
                platter.plateBusiness.permissions.cPltIms = permissions.cPltIms;
            }
            if (isValidPermission(permissions.mPltIms)) {
                platter.plateBusiness.permissions.mPltIms = permissions.mPltIms;
            }
            if (isValidPermission(permissions.moveImToDiff)) {
                platter.plateBusiness.permissions.moveImToDiff = permissions.moveImToDiff;
            }
            if (isValidPermission(permissions.moveImToDiff)) {
                platter.plateBusiness.permissions.moveImToDiff = permissions.moveImToDiff;
            }
            if (isValidPermission(permissions.aPltIms)) {
                platter.plateBusiness.permissions.aPltIms = permissions.aPltIms;
            }
        }
    }
}

// ------------------------------------------------------------------- Methods
export interface IPlatter{ updatePlatter      (user: IUser, platterInfo: ISimplePlatter): Q.Promise<IPlatter> }
PlatterSchema.methods.updatePlatter = function(user: IUser, platterInfo: ISimplePlatter): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    let thisPlatter: IPlatter = this;

    if (platterInfo.name.length > VALIDATION.NameLength) {
        deferred.reject('name too long');
    } else {
        if (!thisPlatter.team) {
            thisPlatter.name = platterInfo.name;
            thisPlatter.save((err) => {
                if (err) {
                	deferred.reject(err);
                } else {
                    deferred.resolve(thisPlatter);
                }
            });
        } else {
            Team.getByIdForUser(thisPlatter.team.toString(), user).then((team) => {
                if (!team) {
                    deferred.reject('User does not have permission');
                } else {
                    let hasPermission = team.checkPermission(user, PERMISSION_KEYS.CREATE_PLATTERS, false);
                    if (!hasPermission) {
                        deferred.reject('User does not have permission');
                    } else {
                        thisPlatter.name = platterInfo.name;
                        applyPlateBusinessChangesToPlatterIfApplicable(thisPlatter, platterInfo.plateBusiness, team);
                        thisPlatter.save((err) => {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                deferred.resolve(thisPlatter);
                            }
                        });
                    }
                }
            }).catch((reason) => {
                deferred.reject(reason);
            })
        }
    }

    return deferred.promise;
}

function internalCheckPermission (thisPlatter: IPlatter, user: IUser, team: ITeam, permissionKeyToCheckAgainstIfPlateBusiness: string): boolean {
    let permissionToCheckAgainst: PermissionUserType;
    if (!Team.getIsPlateBusiness(team)) {
        return true;
    } else {
        permissionToCheckAgainst = thisPlatter.plateBusiness.permissions[permissionKeyToCheckAgainstIfPlateBusiness];
    }

    // First check to see if this Platter is private and that the User is a member
    if (thisPlatter.plateBusiness.inviteOnly) {
        let isMember = false;
        for (let member of thisPlatter.plateBusiness.members) {
            if (user.id === member.toString()) {
                isMember = true;
                break;
            }
        }
        if (!isMember) {
            // User was not a member
            return false;
        }
    }

    // If the Platter did not have the permission, default to the teams'
    if (!isValidPermission(permissionToCheckAgainst)) {
        permissionToCheckAgainst = team.plateBusiness.permissions[permissionKeyToCheckAgainstIfPlateBusiness];
    }

    // If we're just checking against regular, return true
    if (permissionToCheckAgainst === PermissionUserType.Regular) {
        return true;
    }
    // If the user is the owner of the team, return true
    if (team.owner.toString() === user.id) {
        return true;
    }
    // If the type is owner and we haven't returned yet, it's a no go
    if (permissionToCheckAgainst === PermissionUserType.Owner) {
        return false;
    }

    // Only other thing to check is admin
    let userTeamRef: IUserTeamReference = null;
    for (let teamRef of user.teams) {
        if (teamRef.id === team.id) {
            userTeamRef = teamRef;
            break;
        }
    }
    if (!userTeamRef) {
        return false;
    } else {
        return userTeamRef.role === 'admin';
    }
}

export interface IPlatter{ checkPermission      (user: IUser, permissionKey: string): Q.Promise<IPlatter> }
PlatterSchema.methods.checkPermission = function(user: IUser, permissionKey: string): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    let thisPlatter: IPlatter = this;

    if (!thisPlatter.team) {
        deferred.resolve(thisPlatter);
    } else {
        Team.getByIdForUser(thisPlatter.team.toString(), user).then((team) => {
            let permission = thisPlatter.plateBusiness.permissions.cPlts;
            if (internalCheckPermission(thisPlatter, user, team, permissionKey)) {
                deferred.resolve(thisPlatter);
            } else {
                deferred.reject('User does not have permission');
            }
        }).catch((reason) => {
            deferred.reject(reason);
        })
    }

    return deferred.promise;
}

export interface IPlatter{ getSpecificMembersIfAny      (): string[] }
PlatterSchema.methods.getSpecificMembersIfAny = function(): string[] {
    let thisPlatter: IPlatter = this;
    if (thisPlatter.plateBusiness && thisPlatter.plateBusiness.inviteOnly) {
        return thisPlatter.plateBusiness.members;
    }
    return null;
}

export interface IPlatter{ doesUserHaveAccess      (user: IUser): boolean }
PlatterSchema.methods.doesUserHaveAccess = function(user: IUser): boolean {
    let thisPlatter: IPlatter = this;
    if (user.id === this.owner.toString()) {
        return true;
    }

    for (let userTeam of user.teams) {
        if (thisPlatter.team.toString() === userTeam.id) {
            // We have a match - does the user have access?
            if (Team.verifyUserForTeamId(thisPlatter.team.toString(), user)) {
                // Now see if the user is a member if plate business
                if (thisPlatter.plateBusiness.inviteOnly) {
                    for (let platterMemberId of thisPlatter.plateBusiness.members) {
                        if (platterMemberId === user.id) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    return true;
                }
            }
        }
    }

    return false;
}

export interface IPlatter{ setExpanded      (expanded: boolean): Q.Promise<IPlatter> }
PlatterSchema.methods.setExpanded = function(expanded: boolean): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    let thisPlatter: IPlatter = this;

    if ((expanded === true || expanded === false) && thisPlatter.expanded !== expanded) {
        thisPlatter.expanded = expanded;
        thisPlatter.save((err) => {
            if (err) {
            	deferred.reject(err);
            } else {
                deferred.resolve(thisPlatter);
            }
        })
    } else {
        deferred.resolve(thisPlatter);
    }
    return deferred.promise;
}

function doArchive(user: IUser, thisPlatter: IPlatter): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    let somethingChanged = false;
    if (!thisPlatter.archived) {
        thisPlatter.archived = true;
        somethingChanged = true;
    }

    if (somethingChanged) {
        thisPlatter.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisPlatter);
            }
        })
    } else {
        deferred.resolve(thisPlatter);
    }
    return deferred.promise;
}
export interface IPlatter{ archive      (user: IUser): Q.Promise<IPlatter> }
PlatterSchema.methods.archive = function(user: IUser): Q.Promise<IPlatter> {
    let deferred = Q.defer<IPlatter>();
    let thisPlatter: IPlatter = this;

    if (!thisPlatter.team) {
        doArchive(user, thisPlatter).then((platter) => {
        	deferred.resolve(platter);
        }).catch((reason) => {
            deferred.reject(reason);
        })
    } else {
        Team.getByIdForUser(thisPlatter.team.toString(), user).then((team) => {
        	if (!team) {
        	    deferred.reject('User does not have permission')
            } else {
                let hasPermission = team.checkPermission(user, PERMISSION_KEYS.ARCHIVE_PLATTERS, false);
                if (!hasPermission) {
                    deferred.reject('User does not have permission')
                } else {
                    doArchive(user, thisPlatter).then((platter) => {
                        deferred.resolve(platter);
                    }).catch((reason) => {
                        deferred.reject(reason);
                    })
                }
            }
        }).catch((reason) => {
            deferred.reject(reason)
        })
    }

    return deferred.promise;
}

export interface IPlatter{ simple      (): ISimplePlatter }
PlatterSchema.methods.simple = function(): ISimplePlatter {
    let thisPlatter: IPlatter = this;
    return {
        id: thisPlatter.id,
        name: thisPlatter.name,
        owner: thisPlatter.owner,
        team: thisPlatter.team,
        color: thisPlatter.color,
        modified: thisPlatter.modified,
        created: thisPlatter.created,
        archived: thisPlatter.archived,
        expanded: thisPlatter.expanded,
        plateBusiness: thisPlatter.plateBusiness
    }
}

mongoose.model('Platter', PlatterSchema);

export const Platter: IPlatterStatic = <IPlatterStatic>mongoose.model('Platter');















