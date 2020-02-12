import * as mongoose from "mongoose";
import * as Q from "q";
import {Config} from "../config/config-service";
import {IUser, IUserStatic, ISimpleUser, IUserTeamReference} from "./users";
import {PlateUtil} from "../util/plate-util";
import {BuiltInColors} from "./plates";
import {IMetric} from "./plate-item";
import {ServerPaymentInterval, IStripeCustomerDetails, PaymentStatus, PaymentUtil} from "../util/payment-util";
import {IPlatterPermissions} from "./platters";


// ------------------------------------------------------------------- INTERFACES

export interface ITeamStatic extends mongoose.Model<ITeam> {
    getInvitationsForUser(user: IUser): Q.Promise<ISimpleInvitee[]>;
    isInviteeTokenExpired(invitee: IInvitee): boolean;
    getByIdForUser(id: string, user: IUser): Q.Promise<ITeam>;
    getByIdForInvitationPurposes(id: string): Q.Promise<ITeam>;
    VerifyParameters(object: ISimpleTeam): string;
    VerifyParametersForMember(object: IUserTeamReference): string;
    simpleInvitation(invitation: IInvitee): ISimpleInvitee;
    createTeamForUser(teamName: string, user: IUser): Q.Promise<ITeam>;
}
export interface IMetricDefinition {
    name: string,
    values: string[]
}

export interface ISimpleMetricDefinition {
    name: string,
    values: string[]
}

// This info is PUBLIC to the team.
export interface ISimpleTeamPlateBusinessDetails {
    paymentInterval: ServerPaymentInterval,
    purchaser: string,
    status: PaymentStatus,
    cancelledAt: number,
    purchaserEmail: string,
    permissions: ITeamPlatePermissions
}

// This info is PRIVATE to the purchaser
export interface IPrivatePlateBusinessPaymentDetails {
    last4: string,
    quantity: number,
    taxPercent: number,
    currentPeriodStart: number,
    currentPeriodEnd: number,
    planAmount: number
}

export interface ITeamPlatePermissions extends IPlatterPermissions {
    mTeam: PermissionUserType,
    mPms: PermissionUserType,
    iMmbs: PermissionUserType,
    cPltrs: PermissionUserType,
    aPltrs: PermissionUserType,
    mPltrs: PermissionUserType
}

export interface ITeamPlateBusinessDetails extends ISimpleTeamPlateBusinessDetails, IPrivatePlateBusinessPaymentDetails {
    // Server-private Stripe details - never exposed to client
    _customerId: string,
    _customerEmail: string,
    _subscription: string
}

export interface IInvitee {
    id?: string,
    inviteeEmail: string,
    inviterId: string,
    teamId: string,
    expiration: number,
    inviterName: string,
    inviterEmail: string,
    token: string
}

export interface ISimpleInvitee {
    id: string,
    inviteeEmail: string,
    inviterId: string,
    teamId: string,
    expiration: number;
    teamName: string;
    inviterName: string;
    inviterEmail: string;
}

export interface ITeam extends mongoose.Document {
    id: string;
    name: string;
    color: string;
    owner: string; // This is the user ID
    plateBusiness: ITeamPlateBusinessDetails;
    invitees: IInvitee[];
    getMembers: () => Q.Promise<ISimpleUser[]>
    removeInvitee: (invitee: IInvitee) => void;
    getSimple: () => Q.Promise<ISimpleTeam>;
    metricDefinitions: IMetricDefinition[];
}

export interface ISimpleTeam {
    id: string;
    name: string;
    color: string;
    owner: string;
    invitees: ISimpleInvitee[];
    metricDefinitions: ISimpleMetricDefinition[];
    members: ISimpleUser[];
    plateBusiness: ISimpleTeamPlateBusinessDetails;
}

// ------------------------------------------------------------------- PUBLIC CONSTANTS

export const DEFAULT_METRIC_VALUES = [
    '1',
    '2',
    '3',
    '4',
    '5'
];

export const DEFAULT_PLATE_BUSINESS_PERMISSIONS: ITeamPlatePermissions = {
    mTeam: PermissionUserType.Admin, // Who can modify the team name and color?
    mPms: PermissionUserType.Owner, // Who can modify these permissions?
    iMmbs: PermissionUserType.Admin, // Who can invite members?
    cPltrs: PermissionUserType.Regular, // Who can create Platters?
    aPltrs: PermissionUserType.Admin, // Who can archive Platters?
    mPltrs: PermissionUserType.Regular, // Who can modify Platters?
    cPlts: PermissionUserType.Regular, // Who can create Plates?
    mPlts: PermissionUserType.Regular, // Who can modify Plates? This includes moving Plates to other Platters
    aPlts: PermissionUserType.Regular, // Who can archive Plates?
    cPltIms: PermissionUserType.Regular, // Who can create Plate Items?
    mPltIms: PermissionUserType.Regular, // Who can modify Plate Items? This does not include moving Plate Items.
    moveImToDiff: PermissionUserType.Admin, // Who can move Plate Items to different Plates outside the team?
    aPltIms: PermissionUserType.Regular // Who can archive Plate Items?
}
export const PERMISSION_KEYS = {
    MODIFY_TEAM_NAME_COLOR: 'mTeam',
    MODIFY_TEAM_PERMISSIONS: 'mPms',
    INVITE_MEMBERS: 'iMmbs',
    CREATE_PLATTERS: 'cPltrs',
    ARCHIVE_PLATTERS: 'aPltrs',
    MODIFY_PLATTERS: 'mPltrs',
    CREATE_PLATES: 'cPlts',
    MODIFY_PLATES: 'mPlts',
    ARCHIVE_PLATES: 'aPlts',
    CREATE_PLATE_ITEMS: 'cPltIms',
    MODIFY_PLATE_ITEMS: 'mPltIms',
    MOVE_PLATE_ITEMS_TO_DIFF: 'moveImToDiff',
    ARCHIVE_PLATE_ITEMS: 'aPltIms',
}

// TODO - We shouldn't use the 'admin' or 'owner' strings anymore
export const enum PermissionUserType {
    Owner,
    Admin,
    Regular
}

// ------------------------------------------------------------------- MONGO DEFINITION

let TeamSchema = new mongoose.Schema({
    name: String,
    owner: mongoose.Schema.Types.ObjectId,
    color: {
        type: String,
        default: '#0066CC'
    },
    metricDefinitions: [
        {
            name: String,
            values: [String]
        }
    ],
    plateBusiness: {
        purchaser: mongoose.Schema.Types.ObjectId,
        paymentInterval: Number,
        status: {
            type: Number,
            default: 0
        },
        cancelledAt: Number,
        purchaserEmail: String,
        permissions: {
            mTeam: Number,
            mPms: Number,
            iMmbs: Number,
            cPltrs: Number,
            aPltrs: Number,
            mPltrs: Number,
            cPlts: Number,
            mPlts: Number,
            aPlts: Number,
            cPltIms: Number,
            mPltIms: Number,
            moveImToDiff: Number,
            aPltIms: Number
        },

        // Public Stripe Details (for the purchaser)
        last4: String,
        quantity: Number,
        taxPercent: Number,
        currentPeriodStart: Number,
        currentPeriodEnd: Number,
        planAmount: Number,

        // Server-private Stripe details
        _customerId: String,
        _customerEmail: String,
        _subscription: String
    },
    invitees: [{
        inviteeEmail: String,
        inviterName: String,
        inviterEmail: String,
        inviterId: String,
        teamId: String,
        expiration: Number,
        token: String
    }]
});

// ------------------------------------ Utility

/**
 * Verifies that user either has read access or write access to a team
 * @param teamId
 * @param user
 * @param role
 * @returns {boolean}
 */
export interface ITeamStatic{ verifyUserForTeamId (teamId: string, user: IUser): boolean }
TeamSchema.statics.verifyUserForTeamId = function (teamId: string, user: IUser): boolean {
    for (let userTeam of user.teams) {
        if (userTeam.id === teamId) {
            return true;
        }
    }
    return false;
}

export interface ITeamStatic{ getIsPlateBusiness (team: ITeam): boolean }
TeamSchema.statics.getIsPlateBusiness = function (team: ITeam): boolean {
    // For now
    if (!team) {
        return false;
    }
    return !!(team.plateBusiness && team.plateBusiness._subscription && !team.plateBusiness.cancelledAt);
}

// ------------------------------------ Statics

TeamSchema.statics.VerifyParameters = function(object: ISimpleTeam): string {
    // TODO - Nice to have for users of the API one day
    return null;
}

TeamSchema.statics.VerifyParametersForMember = function(object: IUserTeamReference): string {
    // TODO - Nice to have for users of the API one day
    return null;
}

/**
 * Verifies that the user has permission for the team and resolves.
 * You should usually always get a team through this method only.
 * If you specify a role like 'admin', it will check to make sure user has that.
 * @param id
 * @param user
 * @returns {Promise<ITeam>}
 */
TeamSchema.statics.getByIdForUser = function(id: string, user: IUser): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    if (!id) {
        deferred.resolve(null);
    } else {
        if (!Team.verifyUserForTeamId(id, user)) {
            deferred.reject('User does not have access or auth for team');
        } else {
            this.findById(id, (err, team) => {
                if (err) {
                    deferred.reject('error in getting team by id');
                } else {
                    deferred.resolve(team);
                }
            });
        }
    }
    return deferred.promise;
}

/**
 * Just gets a team by id, but this should only be called to check that a user is invited.
 * (In other words, it should only be called once.)
 * @param id
 * @returns {Promise<ITeam>}
 */
TeamSchema.statics.getByIdForInvitationPurposes = function(id: string): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    this.findById(id, (err, team) => {
        if (err) {
            deferred.reject('error in getting team by id');
        } else {
            deferred.resolve(team);
        }
    })
    return deferred.promise;
}

TeamSchema.statics.createTeamForUser = function(teamName: string, user: IUser): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let team:ITeam = new Team();
    team.name = teamName;
    team.owner = user.id;
    team.color = randomColor();
    team.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            user.teams.push({
                id: team.id,
                role: 'admin'
            });
            user.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(team);
                }
            })
        }
    });
    return deferred.promise;
}

TeamSchema.statics.isInviteeTokenExpired = function(invitee: IInvitee): boolean {
    // TODO - UTC considerations
    return invitee.expiration < new Date().getTime();
}

TeamSchema.statics.getInvitationsForUser = function(user: IUser): Q.Promise<ISimpleInvitee[]> {
    let deferred = Q.defer<ISimpleInvitee[]>();
    Team.find({
        'invitees.inviteeEmail': user.email
    }, function(err, teams) {
        if (err) {
            deferred.resolve(err);
        } else {
            if (!teams) {
                deferred.resolve(null);
            } else {
                let invitations = [];
                for (let team of teams) {
                    for (let invitation of team.invitees) {
                        if (invitation.inviteeEmail === user.email) {
                            // TODO - Do we trim the values that go in the db or does mongo do that for us
                            invitations.push(simpleInvitee(invitation, team));
                        }
                    }
                }
                deferred.resolve(invitations);
            }
        }
    });
    return deferred.promise;
}

TeamSchema.statics.simpleInvitation = function(invitation: IInvitee): ISimpleInvitee {
    return simpleInvitee(invitation, this);
}

// ------------------------------------ Instance

TeamSchema.methods.getMembers = function(): Q.Promise<ISimpleUser[]> {
    const User: IUserStatic = <IUserStatic>mongoose.model('User');
    let deferred = Q.defer<ISimpleUser[]>();
    User.findByTeam(this).then((users) => {
        let simpleUsers = [];
        for (let user of users) {
            simpleUsers.push(user.simple({
                team: this
            }));
        }
        deferred.resolve(simpleUsers);
    }).catch((err) => {
        deferred.reject(err);
    })
    return deferred.promise;
}

function simpleInvitee(invitee: IInvitee, team: ITeam): ISimpleInvitee {
    return {
        id: invitee.id,
        expiration: invitee.expiration,
        inviteeEmail: invitee.inviteeEmail,
        inviterId: invitee.inviterId,
        teamId: invitee.teamId,
        teamName: team.name,
        inviterName: invitee.inviterName,
        inviterEmail: invitee.inviterEmail
    }
}

// This is only ever returned to the user who made the purchase, and NOT on the ISimpleTeam
function simplePlateBusiness(plateBusinessDetail: ITeamPlateBusinessDetails): ISimpleTeamPlateBusinessDetails {
    return {
        paymentInterval: plateBusinessDetail.paymentInterval,
        purchaser: plateBusinessDetail.purchaser,
        status: plateBusinessDetail.status,
        cancelledAt: plateBusinessDetail.cancelledAt,
        purchaserEmail: plateBusinessDetail.purchaserEmail,
        permissions: plateBusinessDetail.permissions
    }
}

TeamSchema.methods.getSimple = function(): Q.Promise<ISimpleTeam> {
    let deferred = Q.defer<ISimpleTeam>();
    let thisTeam: ITeam = this;
    let tokenlessInvitees: ISimpleInvitee[] = [];
    for (let invitee of this.invitees) {
        tokenlessInvitees.push(simpleInvitee(invitee, thisTeam))
    }
    thisTeam.getMembers().then((members) => {
        deferred.resolve({
            id: this.id,
            name: this.name,
            owner: this.owner,
            invitees: tokenlessInvitees,
            color: this.color,
            metricDefinitions: simpleMetricDefinitions(this),
            members: members,
            plateBusiness: simplePlateBusiness(thisTeam.plateBusiness)
        })
    }).catch((reason) => {
        deferred.reject(reason);
    })
    return deferred.promise;
}

function simpleMetricDefinitions(team: ITeam): ISimpleMetricDefinition[] {
    let ret: ISimpleMetricDefinition[] = [];
    for (let metricDef of team.metricDefinitions) {
        ret.push({
            name: metricDef.name,
            values: metricDef.values
        });
    }
    return ret;
}

TeamSchema.methods.removeInvitee = function(invitee: IInvitee) {
    let indexToRemove = -1;
    for (let i = 0; i < this.invitees.length; i++) {
        let teamInvitee = this.invitees[i];
        if (teamInvitee.token === invitee.token) {
            indexToRemove = i;
            break;
        }
    }
    if (indexToRemove > -1) {
        this.invitees.splice(indexToRemove, 1);
        this.save((err) => {
            if (err) {
                Config.HandleServerSideError('Couldn\t remove invitee in team');
            }
        })
    } else {
        Config.HandleServerSideError('Couldn\t find invitee to remove in team');
    }
}

export interface ITeam{ upgradeToPlateBusiness      (user: IUser, paymentInterval: ServerPaymentInterval, teamId: string, stripeDetails: IStripeCustomerDetails): Q.Promise<ITeam> }
TeamSchema.methods.upgradeToPlateBusiness = function(user: IUser, paymentInterval: ServerPaymentInterval, teamId: string, stripeDetails: IStripeCustomerDetails): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let thisTeam: ITeam = this;

    // Validation should be done BEFORE calling this method
    // Because the Stripe method would have already been called

    thisTeam.plateBusiness = {
        paymentInterval: paymentInterval,
        purchaser: user.id,
        purchaserEmail: stripeDetails.customerEmail,
        status: PaymentStatus.Active,
        cancelledAt: null,
        permissions: DEFAULT_PLATE_BUSINESS_PERMISSIONS,

        // Public Stripe Details to the purchaser
        last4: stripeDetails.last4,
        quantity: stripeDetails.quantity,
        taxPercent: stripeDetails.taxPercent,
        currentPeriodStart: stripeDetails.currentPeriodStart,
        currentPeriodEnd: stripeDetails.currentPeriodEnd,
        planAmount: stripeDetails.planAmount,

        // Server-private Stripe Details
        _customerId: stripeDetails.customerId,
        _customerEmail: stripeDetails.customerEmail,
        _subscription: stripeDetails.subscriptionId
    }

    thisTeam.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisTeam);
        }
    })

    return deferred.promise;
}

export interface ITeam{ userIsPurchaserOfPlateBusiness      (user: IUser): boolean }
TeamSchema.methods.userIsPurchaserOfPlateBusiness = function(user: IUser): boolean {
    let thisTeam: ITeam = this;
    return thisTeam.plateBusiness.purchaser.toString() === user.id;
}

export interface ITeam{ removePurchaserFromPlateBusiness      (user: IUser): Q.Promise<ITeam> }
TeamSchema.methods.removePurchaserFromPlateBusiness = function(user: IUser): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let thisTeam: ITeam = this;

    // This is also present in the user controller
    PaymentUtil.cancelPlateBusiness(thisTeam).then((status) => {
        thisTeam.cancelPlateBusiness(user).then((team) => {
            deferred.resolve(team);
        }).catch((reason) => {
            deferred.reject(reason);
        });
    }).catch((reason) => {
        deferred.reject(reason);
    })

    return deferred.promise;
}

export interface ITeam{ getPaymentDetailsForPlateBusinessForPurchaser      (user: IUser): IPrivatePlateBusinessPaymentDetails }
TeamSchema.methods.getPaymentDetailsForPlateBusinessForPurchaser = function(user: IUser): IPrivatePlateBusinessPaymentDetails {
    let thisTeam: ITeam = this;
    if (!Team.getIsPlateBusiness(thisTeam)) {
        return null;
    } else {
        if (thisTeam.plateBusiness.purchaser.toString() !== user.id) {
            return null;
        } else {
            let teamPlateBusiness = thisTeam.plateBusiness;
            return {
                last4: teamPlateBusiness.last4,
                quantity: teamPlateBusiness.quantity,
                taxPercent: teamPlateBusiness.taxPercent,
                currentPeriodStart: teamPlateBusiness.currentPeriodStart,
                currentPeriodEnd: teamPlateBusiness.currentPeriodEnd,
                planAmount: teamPlateBusiness.planAmount
            }
        }
    }
}

export interface ITeamStatic{ arePermissionsValidOptions (permissions: ITeamPlatePermissions): boolean }
TeamSchema.statics.arePermissionsValidOptions = function (permissions: ITeamPlatePermissions): boolean {
    if (permissions) {
        for (let key in permissions) {
            if (
                permissions[key] !== PermissionUserType.Regular &&
                permissions[key] !== PermissionUserType.Admin &&
                permissions[key] !== PermissionUserType.Owner
            ) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export interface ITeam{ updatePlateBusinessPermissions      (user: IUser, permissions: ITeamPlatePermissions): Q.Promise<ITeam> }
TeamSchema.methods.updatePlateBusinessPermissions = function(user: IUser, permissions: ITeamPlatePermissions): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let thisTeam: ITeam = this;
    if (!Team.getIsPlateBusiness(thisTeam)) {
        deferred.reject('Team is not Plate for Business');
    } else {
        if (!Team.arePermissionsValidOptions(permissions)) {
            deferred.reject('Invalid values for permissions');
        } else {
            // Check that this user has permission to make these changes
            let hasPermission = thisTeam.checkPermission(user, PERMISSION_KEYS.MODIFY_TEAM_PERMISSIONS, true);
            if (!hasPermission) {
                deferred.reject('User does not have permission to make changes');
            } else {
                for (let key in permissions) {
                    thisTeam.plateBusiness.permissions[key] = permissions[key];
                }
                thisTeam.save((err) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve(thisTeam);
                    }
                })
            }
        }
    }
    return deferred.promise;
}


export interface ITeam{ cancelPlateBusiness      (user: IUser): Q.Promise<ITeam> }
TeamSchema.methods.cancelPlateBusiness = function(user: IUser): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let thisTeam: ITeam = this;

    // Validation should be done BEFORE calling this method
    // Because the Stripe method would have already been called
    thisTeam.plateBusiness.status = PaymentStatus.NonActive;
    thisTeam.plateBusiness.cancelledAt = Date.now();
    thisTeam.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisTeam);
        }
    })

    return deferred.promise;
}

export interface ITeam{ updateMembersForPlateBusiness      (): Q.Promise<ITeam> }
TeamSchema.methods.updateMembersForPlateBusiness = function(): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let thisTeam: ITeam = this;

    if (!thisTeam.plateBusiness || !thisTeam.plateBusiness._subscription) {
        deferred.reject('Team is not plate business')
    } else {
        thisTeam.getMembers().then((members) => {
        	let numMembers = members.length;
            if (numMembers === thisTeam.plateBusiness.quantity) {
                deferred.resolve(thisTeam);
            } else {
                PaymentUtil.changePlanForPlateBusinessMemberChanges(thisTeam, numMembers).then((changeDetails) => {
                	thisTeam.plateBusiness.quantity = numMembers;
                    thisTeam.save((err) => {
                        if (err) {
                        	deferred.reject(err);
                        } else {
                            deferred.resolve(thisTeam);
                        }
                    })
                }).catch((reason) => {
                    deferred.reject(reason);
                })
            }
        }).catch((reason) => {
            deferred.reject(reason);
        })
    }

    return deferred.promise;
}

export interface ITeam{ createOrGetNewMetricDefinitionForMetric      (metricBody: IMetric): Q.Promise<IMetricDefinition> }
TeamSchema.methods.createOrGetNewMetricDefinitionForMetric = function(metricBody: IMetric): Q.Promise<IMetricDefinition> {
    let deferred = Q.defer<IMetricDefinition>();
    let thisTeam: ITeam = this;

    let foundMetricDefinition = false;
    for (let metricDefinition of thisTeam.metricDefinitions) {
        if (metricDefinition.name === metricBody.name) {
            deferred.resolve(metricDefinition);
            foundMetricDefinition = true;
            break;
        }
    }

    if (!foundMetricDefinition) {
        // Create metric definition
        // For now, we have default metrics of 1 - 5, strings
        if (thisTeam.metricDefinitions.length > 20) {
            deferred.reject('Team has too many metric definitions');
        } else {
            let defaultMetricValues = DEFAULT_METRIC_VALUES;

            thisTeam.metricDefinitions.push({
                name: metricBody.name,
                values: defaultMetricValues
            });

            thisTeam.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    for (let metricDefinition of thisTeam.metricDefinitions) {
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

export interface ITeam{ checkPermission      (user: IUser, permissionKeyToCheckAgainstIfPlateBusiness: string, needsToBeAdminIfNotPlateBusiness: boolean): boolean }
TeamSchema.methods.checkPermission = function(user: IUser, permissionKeyToCheckAgainstIfPlateBusiness: string, needsToBeAdminIfNotPlateBusiness: boolean): boolean {
    let thisTeam: ITeam = this;
    let permissionToCheckAgainst: PermissionUserType;
    if (!Team.getIsPlateBusiness(thisTeam)) {
        if (!needsToBeAdminIfNotPlateBusiness) {
            // If it's not Plate business, and we don't need to be admin, return true
            return true;
        } else {
            permissionToCheckAgainst = PermissionUserType.Admin;
        }
    } else {
        permissionToCheckAgainst = thisTeam.plateBusiness.permissions[permissionKeyToCheckAgainstIfPlateBusiness];
    }
    // If we're just checking against regular, return true
    if (permissionToCheckAgainst === PermissionUserType.Regular) {
        return true;
    }
    // If the user is the owner, return true
    if (thisTeam.owner.toString() === user.id) {
        return true;
    }
    // If the type is owner and we haven't returned yet, it's a no go
    if (permissionToCheckAgainst === PermissionUserType.Owner) {
        return false;
    }

    // Only other thing to check is admin
    let userTeamRef: IUserTeamReference = null;
    for (let teamRef of user.teams) {
        if (teamRef.id === thisTeam.id) {
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

export interface ITeam{ updateTeam      (user: IUser, newTeamProperties: ISimpleTeam): Q.Promise<ITeam> }
TeamSchema.methods.updateTeam = function(user: IUser, newTeamProperties: ISimpleTeam): Q.Promise<ITeam> {
    let deferred = Q.defer<ITeam>();
    let somethingChanged = false;
    let hasPermission = this.checkPermission(user, PERMISSION_KEYS.MODIFY_TEAM_NAME_COLOR);

    if (!hasPermission) {
        deferred.reject('User does not have permission');
    } else {
        if (PlateUtil.IsDefined(newTeamProperties.name)) {
            if (newTeamProperties.name !== this.name) {
                this.name = newTeamProperties.name;
                somethingChanged = true;
            }
        }

        if (PlateUtil.IsDefined(newTeamProperties.color)) {
            if (newTeamProperties.color !== this.color) {
                this.color = newTeamProperties.color;
                somethingChanged = true;
            }
        }

        if (somethingChanged) {
            this.save(function (err) {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(this);
                }
            });
        } else {
            deferred.resolve(this);
        }
    }

    return deferred.promise;
}

function randomColor () {
    return BuiltInColors[Math.floor(Math.random()*BuiltInColors.length)];
}

mongoose.model('Team', TeamSchema);

export const Team: ITeamStatic = <ITeamStatic>mongoose.model('Team');













