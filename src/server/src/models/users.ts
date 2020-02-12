import * as mongoose from "mongoose";
import * as Q from "q";
import {Config} from "../config/config-service";
import {ITeam, IMetricDefinition, ISimpleMetricDefinition, DEFAULT_METRIC_VALUES, Team, PERMISSION_KEYS} from "./teams";
import {Notification} from "./notifications";
import {Resource} from "../resources/resource-service";
import {Plate} from "./plates";
import {PlateMailer} from "../util/plate-mailer";

let jwt = require('jsonwebtoken');
let crypto = require('crypto');

import defer = Q.defer;
import {IMetric} from "./plate-item";
import {Platter} from "./platters";
import {Activity, ServerActivityActionType} from "./activity";
import {PlateUtil} from "../util/plate-util";

export enum ServerUserAccountType {
    Default,
    Gold
}

const ServerUserUploadSize = {
    Default: 20 * 1000 * 1000,
    Second: 200 * 1000 * 1000,
    Third: 300 * 1000 * 1000
}

export interface ServerInitialLoginInfo {
    extraEmails: IExtraEmail[];
}

export interface PlateUserTokenDetails {
    id: string,
    name: string,
    email: string,
    teams: IUserTeamReference[],
    defaultTeam: string,
    exp: number,
    accountType: ServerUserAccountType,
    requestFeedback: boolean
}

interface IProviderDetails {
    id: string;
}

export interface IUserStatic extends mongoose.Model<IUser> {
    findByEmail(email: string): Q.Promise<IUser>;
    findByTeam(team: ITeam): Q.Promise<IUser[]>;
}

export interface IUserTeamReference {
    id: string,
    role: 'admin' | 'user';
}

export interface IExtraEmail {
    email: string,
    isPrimary: boolean
}

export interface IExtraProviderDetails {
    provider: string,
    providerId: string
}

export interface IUser extends mongoose.Document {
    id?: string;
    name?: string;
    email?: string;
    extraEmails: IExtraEmail[];
    upgradedToPlatters?: boolean;
    authProviderGoogle?: IProviderDetails;
    extraProviders?: IExtraProviderDetails[];
    hash?: string;
    salt?: string;
    teams?: IUserTeamReference[];
    defaultTeam?: string;
    accountType?: ServerUserAccountType;
    lastLoggedIn?: number;
    dateRegistered?: number;
    lastSentFeedback?: number;
    feedbacksSent?: number; // This will be one if the user has simply clicked the button
    feedbacks?: {
        content: string,
        rating: number
    }[];
    metricDefinitions: IMetricDefinition[];
    setPassword?: (password: string) => void;
    isPasswordValid?: (password: string) => boolean;
    hasPassword?: () => boolean;
    generateJwt?: () => any;
    getAuthProviderType?: () => string;
    getTeams?: () => Q.Promise<ITeam[]>;
    simple?: (opts?: {team: ITeam}) => ISimpleUser;
}

export interface ISimpleUser {
    id: string;
    name: string;
    email: string;
    accountType: ServerUserAccountType;
    metricDefinitions: ISimpleMetricDefinition[];
}


export interface ISimpleUserTeamRelative extends ISimpleUser {
    roleForTeam?: 'admin' | 'user';
    isOwner?: boolean;
}

const VALIDATION = {
    NameLength: 100
}

let UserSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String
    },
    extraEmails: [
        {
            email: String,
            isPrimary: {
                type: Boolean,
                default: false
            }
        }
    ],
    teams: {
        type: [{
            id: String,
            role: String
        }]
    },
    defaultTeam: String,
    accountType: {
        type: Number,
        default: ServerUserAccountType.Default
    },
    authProviderGoogle: {
        id: {
            type: String
        }
    },
    extraProviders: [
        {
            provider: String,
            providerId: String
        }
    ],
    dateRegistered: {
        type: Date,
        default: Date.now
    },
    metricDefinitions: [
        {
            name: String,
            values: [String]
        }
    ],
    lastLoggedIn: {
        type: Date,
        default: Date.now
    },
    lastSentFeedback: Date,
    feedbacksSent: { // This will be one if the user has simply clicked the button
        type: Number,
        default: 0
    },
    feedbacks: [{
        content: String,
        rating: Number
    }],
    upgradedToPlatters: Boolean,
    hash: String,
    salt: String
});

// ------------------------------------ Statics
export interface IUserStatic {getById(id: string): Q.Promise<IUser> }
UserSchema.statics.getById = function(id: string): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    this.findOne({
        '_id': id,
    }, (err, userDb: IUser) => {
        if (err) {
            const error = 'in find user by id';
            deferred.reject(error);
        } else {
            deferred.resolve(userDb);
        }
    });
    return deferred.promise;
}

UserSchema.statics.findByEmail = function(email: string): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    this.findOne({
        'email': email,
    }, (err, userDb: IUser) => {
        if (err) {
            const error = 'in find user by email';
            deferred.reject(error);
        } else {
            if (!userDb) {
                // Look for the user in extra emails
                this.findOne({
                    'extraEmails.email': email
                }, (err, userDb: IUser) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        // Resolve null if the user is not found
                        deferred.resolve(userDb);
                    }
                })
            } else {
                // Found the main email
                deferred.resolve(userDb);
            }
        }
    });
    return deferred.promise;
}

/**
 * Note that team (and not team id) is required - this is because team should not be retrieved
 * except through the findTeamByIdForUser method.
 * @param teamId
 */
UserSchema.statics.findByTeam = function(team: ITeam): Q.Promise<IUser[]> {
    let deferred = Q.defer<IUser[]>();
    this.find({
        'teams.id': team.id
    }, function (err, users) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(users);
        }
    });
    return deferred.promise;
}

// All registrations go through this method.
export interface IUserStatic {newUser(name: string, email: string, password: string, authProviderGoogle: IProviderDetails): Q.Promise<IUser> }
UserSchema.statics.newUser = function(name: string, email: string, password: string, authProviderGoogle: IProviderDetails): Q.Promise<IUser> {

    let deferred = Q.defer<IUser>();

    let valid = true;
    if (name && name.length > VALIDATION.NameLength) {
        valid = false;
        deferred.reject('Name too long');
    }

    if (valid) {
        const user = new User();
        user.name = name;
        user.email = email;
        if (password) {
            user.setPassword(password);
        }
        if (authProviderGoogle) {
            user.authProviderGoogle = authProviderGoogle;
        }

        user.save((userSaveError) => {
            if (userSaveError) {
                Config.HandleServerSideError('in save user');
                deferred.reject(Resource.Translatable.ERROR_Unknown);
            } else {
                // Check for notifications
                Notification.resolveInvitesForEmail(user).then((notifications) => {
                    // Create new Plate
                    Platter.createDefaultPlatter(user).then((platter) => {
                        Plate.createDefaultPlate(user, platter).then((plate) => {
                            deferred.resolve(user);
                            PlateMailer.sendThanksForSigningUpEmail(user);
                        }).catch((reason) => {
                            Config.HandleServerSideError('in save plate for registering user');
                            deferred.reject(Resource.Translatable.ERROR_Unknown);
                        });
                    }).catch((reason) => {
                        Config.HandleServerSideError('in create default platter for user');
                        deferred.reject(reason);
                    })
                }).catch((reason) => {
                    Config.HandleServerSideError('in resolve notifications for email');
                    deferred.reject(reason);
                })
            }
        });
    }

    return deferred.promise;
}

export interface IUserStatic {isUserIdMemberOfTeam(memberId: string, teamId: string): Q.Promise<boolean> }
UserSchema.statics.isUserIdMemberOfTeam = function(memberId: string, teamId: string): Q.Promise<boolean> {
    let deferred = Q.defer<boolean>();
    if (!teamId) {
        deferred.resolve(true);
    } else {
        User.findById(memberId, (err, user) => {
            if (err) {
                deferred.reject(err);
            } else {
                let teams = user.teams;
                let foundTeam = false;
                for (let userTeam of teams) {
                    if (userTeam.id === teamId) {
                        foundTeam = true;
                        break;
                    }
                }
                if (!foundTeam) {
                    deferred.reject('user is not member of team');
                } else {
                    deferred.resolve(true);
                }
            }
        });
    }
    return deferred.promise;
}

// ------------------------------------ Instance

UserSchema.methods.setPassword = function(password: string) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
}

UserSchema.methods.isPasswordValid = function (password: string) {
    let hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
    return this.hash === hash;
}

UserSchema.methods.generateJwt = function() {
    let thisUser: IUser = this;
    let expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    this.lastLoggedIn = Date.now();
    this.save((err) => {
        // Save asynchronously
        if (err) {
            Config.HandleServerSideError('error in save user logged in');
        }
    });

    let requestFeedback = false;
    // If the user has not seen the feedback button but has
    // been registered for more than 30 minutes, request it.
    // Later we can do plenty with this
    if (!thisUser.feedbacksSent) {
        if (Date.now() - thisUser.dateRegistered > 1000*60*30) {
            requestFeedback = true;
        }
    }

    let jwtTokenDetails: PlateUserTokenDetails = {
        id: this._id,
        name: thisUser.name,
        email: thisUser.email,
        teams: thisUser.teams,
        defaultTeam: thisUser.defaultTeam,
        exp: parseInt(<any>(expiry.getTime() / 1000)),
        requestFeedback: requestFeedback,
        accountType: thisUser.accountType
    }

    return jwt.sign(jwtTokenDetails, Config.Keys.JWT_SECRET);
};

export interface IUser{ didUpgradeToPlatters      (): Q.Promise<IUser> }
UserSchema.methods.didUpgradeToPlatters = function(): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    thisUser.upgradedToPlatters = true;
    thisUser.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisUser);
        }
    })
    return deferred.promise;
}

export interface IUser{ addAuthProviderGoogle      (profileId: string): Q.Promise<IUser> }
UserSchema.methods.addAuthProviderGoogle = function(profileId: string): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    thisUser.authProviderGoogle = {
        id: profileId
    }
    thisUser.save((userSaveError) => {
        if (userSaveError) {
            Config.HandleServerSideError('in attach main google provider to user');
            deferred.reject(userSaveError);
        } else {
            deferred.resolve(thisUser);
        }
    });
    return deferred.promise;
}

export interface IUser{ addExtraProvider      (extraProviderDetails: IExtraProviderDetails): Q.Promise<IUser> }
UserSchema.methods.addExtraProvider = function(extraProviderDetails: IExtraProviderDetails): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    thisUser.extraProviders.push(extraProviderDetails);
    thisUser.save((userSaveError) => {
        if (userSaveError) {
            Config.HandleServerSideError('in attach extra provider to user');
            deferred.reject(userSaveError);
        } else {
            deferred.resolve(thisUser);
        }
    });
    return deferred.promise;
}

export interface IUser{ addExtraEmail      (email: string): Q.Promise<IUser> }
UserSchema.methods.addExtraEmail = function(email: string): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;

    if ((!thisUser.email && thisUser.extraEmails.length) > 3 || (thisUser.email && thisUser.extraEmails.length > 2)) {
        deferred.reject('Too many emails for user');
    } else {
        if (!PlateUtil.emailIsValid(email)) {
            deferred.reject('email is not valid');
        } else {
            User.findByEmail(email).then((existingUser) => {
            	if (existingUser) {
            	    deferred.reject('Email already in use');
                } else {
                    let foundDuplicateEmail = false;
                    if (thisUser.email === email) {
                        foundDuplicateEmail = true;
                    }
                    for (let extraEmail of thisUser.extraEmails) {
                        if (extraEmail.email === email) {
                            foundDuplicateEmail = true;
                            break;
                        }
                    }
                    if (foundDuplicateEmail) {
                        deferred.reject('Found duplicate email');
                    } else {
                        thisUser.extraEmails.push({
                            email: email,
                            isPrimary: false
                        });
                        thisUser.save((err) => {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                deferred.resolve(thisUser);
                            }
                        })
                    }
                }
            }).catch((reason) => {
                deferred.reject(reason);
            })
        }
    }

    return deferred.promise;
}

export interface IUser{ removeExtraEmail      (email: string): Q.Promise<IUser> }
UserSchema.methods.removeExtraEmail = function(email: string): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;

    let didRemoveEmail = false;
    let hasOnlyOneEmail = false;

    if (thisUser.email === email) {
        if (thisUser.extraEmails.length) {
            thisUser.email = null;
            didRemoveEmail = true;
        } else {
            hasOnlyOneEmail = true;
        }
    }
    if (!didRemoveEmail && !hasOnlyOneEmail) {
        if (!thisUser.email && thisUser.extraEmails.length < 2) {
            deferred.reject('Cannot remove only email');
        } else {
            for (let i = 0; i < thisUser.extraEmails.length; i++) {
                let extraEmailObject = thisUser.extraEmails[i];
                if (extraEmailObject.email === email) {
                    thisUser.extraEmails.splice(i, 1);
                    didRemoveEmail = true;
                    break;
                }
            }
        }
    }

    if (!didRemoveEmail) {
        deferred.reject('email did not exist on user');
    } else if (hasOnlyOneEmail) {
        deferred.reject('user has only one email');
    } else {
        thisUser.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisUser);
            }
        })
    }

    return deferred.promise;
}

export interface IUser{ getPrimaryEmail      (): string }
UserSchema.methods.getPrimaryEmail = function(): string {
    // For now just return one of the emails
    let thisUser: IUser = this;
    if (thisUser.email) {
        return thisUser.email;
    }
    return thisUser.extraEmails[0].email;
}


export interface IUser{ getMaxUploadSize      (team: ITeam): number }
UserSchema.methods.getMaxUploadSize = function(team: ITeam): number {
    let thisUser: IUser = this;
    if (team && Team.getIsPlateBusiness(team)) {
        return ServerUserUploadSize.Third;
    }
    if (thisUser.accountType === ServerUserAccountType.Gold) {
        return ServerUserUploadSize.Second;
    }
    return ServerUserUploadSize.Default;
}

export interface IUser{ recordFeedbackSent      (feedbackContent: string, feedbackRating: number): Q.Promise<IUser> }
UserSchema.methods.recordFeedbackSent = function(feedbackContent: string, feedbackRating: number): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    thisUser.feedbacksSent++;
    thisUser.lastSentFeedback = Date.now();
    if (feedbackContent || feedbackRating) {
        thisUser.feedbacks.push({
            content: feedbackContent,
            rating: feedbackRating
        });
    }
    thisUser.save((err) => {
        if (err) {
        	deferred.reject(err);
        } else {
            deferred.resolve(thisUser);
        }
    })
    return deferred.promise;
}

UserSchema.methods.getAuthProviderType = function() {
    const user = <IUser>this;
    if (user.authProviderGoogle.id) {
        return Config.Keys.Providers.Google.NAME;
    } else {
        return null;
    }
}

export interface IUser{ hasMainGoogleProviderForId      (providerId: string): boolean }
UserSchema.methods.hasMainGoogleProviderForId = function(providerId: string): boolean {
    const user = <IUser>this;
    return user.authProviderGoogle.id === providerId;
}

export interface IUser{ hasExtraProviderForId      (providerName: string, providerId: string): boolean }
UserSchema.methods.hasExtraProviderForId = function(providerName: string, providerId: string): boolean {
    const user = <IUser>this;
    if (user.extraProviders && user.extraProviders.length) {
        for (let extraProvider of user.extraProviders) {
            if (extraProvider.provider === providerName) {
                if (extraProvider.providerId === providerId) {
                    return true;
                }
            }
        }
    }
    return false;
}

UserSchema.methods.hasPassword = function() {
    return this.hash && this.salt;
}

export interface IUser{ getActivities      (): Q.Promise<IUser> }
UserSchema.methods.getActivities = function() {

}

/**
 * Does not attach team members to the teams.
 * @returns {Promise<ITeam[]>}
 */
UserSchema.methods.getTeams = function(): Q.Promise<ITeam[]> {
    let deferred = Q.defer<ITeam[]>();
    if (this.teams && this.teams.length) {
        let teamIdsArray = this.getTeamIds();
        Team.find({
            '_id': { $in: teamIdsArray}
        },
            function(err, teams) {
                if (err) {
                    deferred.reject('Error getting teams');
                } else {
                    deferred.resolve(<ITeam[]>teams);
                }
            }
        )
    } else {
        deferred.resolve([])
    }
    return deferred.promise;
}

export interface IUser{ getTeamIds      (): string[] }
UserSchema.methods.getTeamIds = function(): string[] {
    let teamIdsArray: string[] = [];
    for (let team of this.teams) {
        teamIdsArray.push(team.id);
    }
    return teamIdsArray;
}

UserSchema.methods.getTeamRole = function (team: ITeam): string {
    for (let userTeam of this.teams) {
        if (userTeam.id === team.id) {
            return userTeam.role;
        }
    }
    return null;
}



UserSchema.methods.simple = function(opts?: {team: ITeam}): ISimpleUser | ISimpleUserTeamRelative {
    let simpleUser: ISimpleUser | ISimpleUserTeamRelative = {
        name: this.name,
        email: this.email,
        id: this.id,
        metricDefinitions: simpleMetricDefinitions(this),
        accountType: this.accountType
    }
    if (opts) {
        if (opts.team) {
            (<ISimpleUserTeamRelative>simpleUser).roleForTeam = this.getTeamRole(opts.team);
            (<ISimpleUserTeamRelative>simpleUser).isOwner = opts.team.owner.toString() === this.id;
        }
    }
    return simpleUser;
}

function simpleMetricDefinitions(user: IUser): ISimpleMetricDefinition[] {
    let ret: ISimpleMetricDefinition[] = [];
    for (let metricDef of user.metricDefinitions) {
        ret.push({
            name: metricDef.name,
            values: metricDef.values
        });
    }
    return ret;
}

export interface IUser{ addTeam      (team: ITeam, teamReference: IUserTeamReference): Q.Promise<IUser> }
UserSchema.methods.addTeam = function(team: ITeam, teamReference: IUserTeamReference): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    let duplicate = false;
    for (let userTeam of this.teams) {
        if (userTeam.id === team.id) {
            duplicate = true;
            break;
        }
    }
    if (duplicate) {
        deferred.reject('Team already exists');
    } else {
        this.teams.push(teamReference);
    }

    if (!duplicate) {
        this.save((err) => {
            if (err) {
                deferred.reject(err);
                Config.HandleServerSideError('Error in save user add team');
            } else {
                if (!Team.getIsPlateBusiness(team)) {
                    deferred.resolve(this);
                    Activity.createActivity(null, null, thisUser, null, team.id, ServerActivityActionType.UserJoinedTeam, team.color, team.name);
                } else {
                    team.updateMembersForPlateBusiness().then((team) => {
                        deferred.resolve(this);
                        Activity.createActivity(null, null, thisUser, null, team.id, ServerActivityActionType.UserJoinedTeam, team.color, team.name);
                    }).catch((reason) => {
                        deferred.reject(reason);
                    })
                }
            }
        });
    } else {
        deferred.resolve(this);
    }

    return deferred.promise;
}

export interface IUser{ createOrGetNewMetricDefinitionForMetric      (metricBody: IMetric): Q.Promise<IMetricDefinition> }
UserSchema.methods.createOrGetNewMetricDefinitionForMetric = function(metricBody: IMetric): Q.Promise<IMetricDefinition> {
    let deferred = Q.defer<IMetricDefinition>();
    let thisUser: IUser = this;

    let foundMetricDefinition = false;
    for (let metricDefinition of thisUser.metricDefinitions) {
        if (metricDefinition.name === metricBody.name) {
            deferred.resolve(metricDefinition);
            foundMetricDefinition = true;
            break;
        }
    }

    if (!foundMetricDefinition) {
        // Create metric definition
        // For now, we have default metrics of 1 - 5, strings

        if (thisUser.metricDefinitions.length > 20) {
            deferred.reject('User has too many metric definitions');
        } else {
            let defaultMetricValues = DEFAULT_METRIC_VALUES;

            thisUser.metricDefinitions.push({
                name: metricBody.name,
                values: defaultMetricValues
            });

            thisUser.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    for (let metricDefinition of thisUser.metricDefinitions) {
                        if (metricDefinition.name === metricBody.name) {
                            deferred.resolve(metricDefinition);
                            break;
                        }
                    }
                }
            })
        }

    }

    return deferred.promise;
}

export interface IUser{ updateTeam      (userPerformingAction: IUser, team: ITeam, newBody: IUserTeamReference, save: boolean): Q.Promise<IUser> }
UserSchema.methods.updateTeam = function(userPerformingAction: IUser, team: ITeam, newBody: IUserTeamReference, save: boolean): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let foundTeam: IUserTeamReference = null;
    for (let userTeam of this.teams) {
        if (userTeam.id === team.id) {
            foundTeam = userTeam;
            break;
        }
    }
    if (!foundTeam) {
        deferred.reject('User not found in team');
    } else {
        let hasPermission = team.checkPermission(userPerformingAction, PERMISSION_KEYS.INVITE_MEMBERS, true);
        if (!hasPermission) {
            deferred.reject('User does not have permission');
        } else {
            if (!(newBody.role === 'admin' || newBody.role === 'user')) {
                deferred.reject('Role must be admin or user');
            } else {
                foundTeam.role = newBody.role;
                if (save) {
                    this.save((err) => {
                        if (err) {
                            deferred.reject(err);
                            Config.HandleServerSideError('Error in save user modify team');
                        } else {
                            deferred.resolve(this);
                        }
                    });
                } else {
                    deferred.resolve(this);
                }
            }
        }
    }
    return deferred.promise;
}

function removeFromTeam(team: ITeam, user: IUser): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    // Find any platters that belonged to the team that the user owned
    // We'll change ownership to the team's owner
    Platter.changeOwnershipForTeamRemoval(team, user).then((numChanged) => {
        deferred.resolve(user);
    }).catch((reason) => {
        deferred.reject(reason);
    })
    return deferred.promise;
}
export interface IUser { removeTeam     (team: ITeam, userThatDidRemoval: IUser): Q.Promise<IUser> }
UserSchema.methods.removeTeam = function(team: ITeam, userThatDidRemoval: IUser): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    let thisUser: IUser = this;
    let foundTeamIndex: number = null;
    for (let i=0; i < this.teams.length; i++) {
        let userTeam = this.teams[i];
        if (userTeam.id === team.id) {
            foundTeamIndex = i;
            break;
        }
    }
    if (foundTeamIndex == null) {
        deferred.reject('User not found in team');
    } else {
        if (team.owner === this.id) {
            deferred.reject('Cannot remove owner of a team');
        } else {
            this.teams.splice(foundTeamIndex, 1);
            this.save((err) => {
                if (err) {
                    deferred.reject(err);
                    Config.HandleServerSideError('Error in save user remove team');
                } else {
                    // Update team members if Plate for Business
                    if (Team.getIsPlateBusiness(team)) {
                        if (!team.userIsPurchaserOfPlateBusiness(this)) {
                            team.updateMembersForPlateBusiness().then((team) => {
                                removeFromTeam(team, thisUser).then((deletedUser) => {
                                	deferred.resolve(deletedUser)
                                }).catch((reason) => {
                                    deferred.reject(reason);
                                })
                            }).catch((reason) => {
                                deferred.reject(reason);
                            });
                        } else {
                            team.removePurchaserFromPlateBusiness(this).then((team) => {
                                removeFromTeam(team, thisUser).then((deletedUser) => {
                                    deferred.resolve(deletedUser)
                                }).catch((reason) => {
                                    deferred.reject(reason);
                                })
                            }).catch((reason) => {
                                deferred.reject(reason);
                            })
                        }
                    } else {
                        removeFromTeam(team, thisUser).then((deletedUser) => {
                            deferred.resolve(deletedUser)
                        }).catch((reason) => {
                            deferred.reject(reason);
                        })
                    }
                }
            });
        }
    }
    return deferred.promise;
}

export interface IUserStatic { removeFromTeam: (memberIdToDelete: string, team: ITeam, userThatDidRemoval: IUser) => Q.Promise<IUser> }
UserSchema.statics.removeFromTeam = function(memberIdToDelete: string, team: ITeam, userThatDidRemoval: IUser): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();
    User.findById(memberIdToDelete, (err, memberToDelete: IUser) => {
        if (err) {
            deferred.reject(err);
        } else {
            memberToDelete.removeTeam(team, userThatDidRemoval).then(() => {
                deferred.resolve(memberToDelete);
            }).catch((reason) => {
                deferred.reject(err);
            })
        }
    });
    return deferred.promise;
}

export interface IUser { updateUser: (details: ISimpleUser) => Q.Promise<IUser> }
UserSchema.methods.updateUser = function(details: ISimpleUser): Q.Promise<IUser> {
    let deferred = Q.defer<IUser>();

    let valid = true;
    let somethingChanged = false;
    if (details.name) {
        if (this.name !== details.name) {
            if (details.name.length > VALIDATION.NameLength) {
                valid = false;
                deferred.reject('Name is too long');
            } else {
                this.name = details.name;
                somethingChanged = true;
            }
        }
    }

    if (valid && somethingChanged) {
        this.save((err) => {
            if (err) {
            	deferred.reject(err);
            } else {
                deferred.resolve(this);
            }
        })
    }

    return deferred.promise;
}

mongoose.model('User', UserSchema);
export const User: IUserStatic = <IUserStatic>mongoose.model('User');






















