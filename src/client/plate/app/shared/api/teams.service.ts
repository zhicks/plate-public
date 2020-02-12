import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {NewBaseApiService} from "./platebase.service";
import {AuthHttp} from "angular2-jwt";
import {UsersService} from "./users.service";
import {LoggedInUser, ClientUserTeamReference} from "../../../../shared/scripts/auth.service";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {ClientPlatterPermissions, UIClientPlatter} from "./platter.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";

// ------------------------------------------------------------------- PUBLIC INTERFACES

export interface ClientTeamInvitation {
    id: string;
    teamId: string;
    inviterId: string;
    inviteeEmail: string;
    expiration: number;
    inviterName: string;
    teamName: string;
    inviterEmail: string;
}

export interface ClientPlateBusinessDetails {
    paymentInterval: ClientPaymentInterval,
    purchaser: string,
    status: ClientPaymentStatus,
    cancelledAt: number,
    purchaserEmail: string,
    permissions: ClientTeamPlatePermissions
}

export interface ClientTeam {
    name: string;
    id?: string;
    owner?: string;
    invitees?: ClientTeamInvitation[],
    color?: string;
    members?: ClientTeamMember[];
    plateBusiness?: ClientPlateBusinessDetails;
}

export interface ClientPlateBusinessPaymentDetails {
    last4: string
    quantity: number,
    taxPercent: number,
    currentPeriodStart: number,
    currentPeriodEnd: number,
    planAmount: number
}

export interface ClientTeamPlatePermissions extends ClientPlatterPermissions {
    mTeam: ClientPermissionUserType,
    mPms: ClientPermissionUserType,
    iMmbs: ClientPermissionUserType,
    cPltrs: ClientPermissionUserType,
    aPltrs: ClientPermissionUserType,
    mPltrs: ClientPermissionUserType
}

export enum ClientUserAccountType {
    Default,
    Gold
}

export interface ClientTeamMember {
    id: string;
    name: string;
    email: string;
    accountType: ClientUserAccountType;
    roleForTeam: 'user' | 'admin'
    //metricDefinitions
}

// ------------------------------------------------------------------- PUBLIC CONSTANTS

export enum ClientPermissionUserType {
    Owner,
    Admin,
    Regular
}
export const ClientPermissionUserTypeStrings = {
    0: 'Owner',
    1: 'Admin',
    2: 'Regular'
}

export enum ClientPaymentInterval {
    Monthly,
    Yearly
}

export enum ClientPaymentStatus {
    Active,
    NonActive,
    Deliquent
}

// ------------------------------------------------------------------- CLASSES

export class Permissions {
    static checkPermission(userPermission: ClientPermissionUserType, permissionToCheckAgainst: ClientPermissionUserType) {
        switch (permissionToCheckAgainst) {
            case ClientPermissionUserType.Regular:
                return true;
            case ClientPermissionUserType.Admin:
                return userPermission === ClientPermissionUserType.Admin || userPermission === ClientPermissionUserType.Owner;
            case ClientPermissionUserType.Owner:
                return userPermission === ClientPermissionUserType.Owner;
        }
    }

    static isValidPermission(permission) {
        let valid = permission === ClientPermissionUserType.Regular ||
            permission === ClientPermissionUserType.Admin ||
            permission === ClientPermissionUserType.Owner;
        return valid;
    }

    static getPlatterPermissionSet(platter: UIClientPlatter, team: UIClientTeam) {
        if (!platter || !team || !team.isPlateBusiness) {
            return [];
        }

        // First get the team default permissions
        let permissions = ClientUtil.copyShallowObject(team.model.plateBusiness.permissions);

        // Then override with the Platter permissions
        for (let key in platter.model.plateBusiness.permissions) {
            permissions[key] = platter.model.plateBusiness.permissions[key];
        }
        let arr = [];
        arr.push(Permissions.getPlatesPermissionSet(permissions, platter.model.plateBusiness.permissions));
        arr.push(Permissions.getPlateItemsPermissionSet(permissions, platter.model.plateBusiness.permissions));
        return arr;
    }
    static getPlateBusinessTeamPermissionSetForPermissions(permission: ClientTeamPlatePermissions) {
        let arr = [
            {
                title: 'Team',
                permissions: [
                    {
                        title: 'Who can modify these permissions?',
                        key: 'mPms',
                        userType: permission.mPms
                    },
                    {
                        title: 'Who can invite members?',
                        key: 'iMmbs',
                        userType: permission.iMmbs
                    },
                    {
                        title: 'Who can modify the team name and color?',
                        key: 'mTeam',
                        userType: permission.mTeam
                    }
                ]
            },
            {
                title: 'Platters',
                permissions: [
                    {
                        title: 'Who can create Platters?',
                        key: 'cPltrs',
                        userType: permission.cPltrs
                    },
                    {
                        title: 'Who can modify Platters?',
                        key: 'mPltrs',
                        userType: permission.mPltrs
                    },
                    {
                        title: 'Who can archive Platters?',
                        key: 'aPltrs',
                        userType: permission.aPltrs
                    }
                ]
            }
        ]

        arr.push(Permissions.getPlatesPermissionSet(permission));
        arr.push(Permissions.getPlateItemsPermissionSet(permission));

        return arr;
    }

    private static getPlatesPermissionSet(permission: ClientTeamPlatePermissions, overrides?: ClientPlatterPermissions) {
        return {
            title: 'Plates',
            permissions: [
                {
                    title: 'Who can create Plates?',
                    key: 'cPlts',
                    userType: permission.cPlts,
                    isOverride: overrides ? Permissions.isValidPermission(overrides['cPlts']) : false
                },
                {
                    title: 'Who can modify Plates?',
                    key: 'mPlts',
                    userType: permission.mPlts,
                    extra: 'This includes moving Plates to other Platters.',
                    isOverride: overrides ? Permissions.isValidPermission(overrides['mPlts']) : false
                },
                {
                    title: 'Who can archive Plates?',
                    key: 'aPlts',
                    userType: permission.aPlts,
                    isOverride: overrides ? Permissions.isValidPermission(overrides['aPlts']) : false
                }
            ]
        }
    }

    private static getPlateItemsPermissionSet(permission: ClientTeamPlatePermissions, overrides?: ClientPlatterPermissions) {
        return {
            title: 'Plate Items',
            permissions: [
                {
                    title: 'Who can create Plate Items?',
                    key: 'cPltIms',
                    userType: permission.cPltIms,
                    isOverride: overrides ? Permissions.isValidPermission(overrides['cPltIms']) : false
                },
                {
                    title: 'Who can modify Plate Items?',
                    key: 'mPltIms',
                    userType: permission.mPltIms,
                    extra: 'This does not include moving Plate Items.',
                    isOverride: overrides ? Permissions.isValidPermission(overrides['mPltIms']) : false
                },
                {
                    title: 'Who can move Plate Items to different Plates (including outside the team)?',
                    key: 'moveImToDiff',
                    userType: permission.moveImToDiff,
                    isOverride: overrides ? Permissions.isValidPermission(overrides['moveImToDiff']) : false
                },
                {
                    title: 'Who can archive Plate Items?',
                    key: 'aPltIms',
                    userType: permission.aPltIms,
                    isOverride: overrides ? Permissions.isValidPermission(overrides['aPltIms']) : false
                }
            ]
        }
    }

}

export class UIClientTeamMember {
    model: ClientTeamMember;
    selected: boolean;
    initials: string;

    constructor(
        model: ClientTeamMember
    ) {
        this.model = model;
        this.initials =  UsersService.getInitials(this.model.name);
    }
}

interface UIClientTeamMemberMap {
    [memberId: string]: UIClientTeamMember
}
export class UIClientTeam {
    expanded: boolean = true;
    isUser: boolean;
    private members: UIClientTeamMemberMap = {};
    model: ClientTeam;
    sortedMembers: UIClientTeamMember[] = [];
    isPlateBusiness = false;
    paymentIntervalString = '';
    lazyTeamRef: ClientUserTeamReference = null;

    constructor(
        model: ClientTeam,
        teamsService: TeamsService
    ) {
        this.model = model;
        model.members = model.members || [];
        for (let member of model.members) {
            let uiClientTeamMember = new UIClientTeamMember(member);
            this.members[member.id] = uiClientTeamMember;
            teamsService.memberPool[member.id] = uiClientTeamMember;
        }
        this.updateSortedMembers();
        this.updateIsPlateBusiness();
    }

    addMember(member: UIClientTeamMember) {
        this.members[member.model.id] = member;
        this.updateSortedMembers();
    }

    removeMember(memberId: string) {
        delete this.members[memberId];
        for (let i = 0; i < this.model.members.length; i++) {
            let member = this.model.members[i];
            if (member.id === memberId) {
                this.model.members.splice(i, 1);
                break;
            }
        }
        this.updateSortedMembers();
    }

    updateIsPlateBusiness() {
        if (this.model.plateBusiness && this.model.plateBusiness.purchaser) {
            if (!this.model.plateBusiness.cancelledAt) {
                this.isPlateBusiness = true;
                if (this.model.plateBusiness.paymentInterval === ClientPaymentInterval.Monthly) {
                    this.paymentIntervalString = 'Monthly';
                } else {
                    this.paymentIntervalString = 'Yearly';
                }
            } else {
                this.isPlateBusiness = false;
            }
        }
    }

    removePlateBusinessStatus() {
        this.model.plateBusiness.cancelledAt = Date.now();
        this.updateIsPlateBusiness();
    }

    private updateSortedMembers() {
        this.sortedMembers = [];
        for (let memberId in this.members) {
            let member = this.members[memberId];
            this.sortedMembers.push(member);
        }
        this.sortedMembers.sort((a, b) => {
            if (a.model.id === this.model.owner) {
                return -1;
            } else if (b.model.id === this.model.owner) {
                return 1;
            } else {
                let lowercaseA = a.model.name && a.model.name.toLowerCase();
                let lowercaseB = b.model.name && b.model.name.toLocaleLowerCase();
                if (lowercaseA < lowercaseB) {
                    return -1;
                }
                if (lowercaseA > lowercaseB) {
                    return 1;
                }
            }
            return 0;
        })
    }

    lazilySetTeamReference(user: LoggedInUser) {
        if (this.lazyTeamRef) {
            return;
        }
        let teamReferences = user.teams;
        for (let userTeam of teamReferences) {
            if (userTeam.id === this.model.id) {
                this.lazyTeamRef = userTeam;
                break;
            }
        }
    }

    private checkPermission(user: LoggedInUser, permission: ClientPermissionUserType) {
        if (this.model.plateBusiness) {
            let userPermission = ClientPermissionUserType.Regular;
            if (this.model.owner === user.id) {
                userPermission = ClientPermissionUserType.Owner;
            } else if (this.lazyTeamRef && this.lazyTeamRef.role === 'admin') {
                userPermission = ClientPermissionUserType.Admin;
            }
            return Permissions.checkPermission(userPermission, permission);
        }
    }
    canModifyNameAndColor(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.isPlateBusiness) {
            return this.lazyTeamRef && this.lazyTeamRef.role === 'admin';
        } else {
            let permission = this.model.plateBusiness.permissions.mTeam;
            return this.checkPermission(user, permission);
        }
    }
    canModifyTeamPermissions(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.isPlateBusiness) {
            return this.lazyTeamRef && this.lazyTeamRef.role === 'admin';
        } else {
            let permission = this.model.plateBusiness.permissions.mPms;
            return this.checkPermission(user, permission);
        }
    }
    canInviteMembers(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.isPlateBusiness) {
            return this.lazyTeamRef && this.lazyTeamRef.role === 'admin';
        } else {
            let permission = this.model.plateBusiness.permissions.iMmbs;
            return this.checkPermission(user, permission);
        }
    }
    canAddPlatter(user: LoggedInUser) {
        if (!this.isPlateBusiness) {
            return true;
        } else {
            this.lazilySetTeamReference(user);
            let permission = this.model.plateBusiness.permissions.cPltrs;
            return this.checkPermission(user, permission);
        }
    }
    canArchivePlatter(user: LoggedInUser) {
        if (!this.isPlateBusiness) {
            return true;
        } else {
            this.lazilySetTeamReference(user);
            let permission = this.model.plateBusiness.permissions.aPltrs;
            return this.checkPermission(user, permission);
        }
    }
    canModifyPlatter(user: LoggedInUser) {
        if (!this.isPlateBusiness) {
            return true;
        } else {
            this.lazilySetTeamReference(user);
            let permission = this.model.plateBusiness.permissions.mPltrs;
            return this.checkPermission(user, permission);
        }
    }
}

@Injectable()
export class TeamsService extends NewBaseApiService<ClientTeam, UIClientTeam> {

    private url = '/api/team';
    userPrivateTeam: UIClientTeam = new UIClientTeam({
        name: 'Private',
        id: 'private'
    }, this);
    memberPool: {
        [memberId: string]: UIClientTeamMember
    } = {}

    constructor(protected authHttp: AuthHttp, private usersService: UsersService, private plateErrorHandler: PlateErrorHandlerService){
        super(authHttp);
        this.userPrivateTeam.expanded = true;
        this.userPrivateTeam.isUser = true;
    }

    setUser(user: LoggedInUser) {
        let userAsTeamMember: ClientTeamMember = {
            id: user.id,
            name: user.name,
            email: user.email,
            accountType: user.accountType,
            roleForTeam: 'admin'
        };
        this.userPrivateTeam.addMember(new UIClientTeamMember(userAsTeamMember));
    }

    transformForUI (team: ClientTeam): UIClientTeam {
        return new UIClientTeam(team, this);
    }

    get(): Observable<UIClientTeam[]> {
        const url = `${this.url}`;
        return super.getMultiple(url);
    }

    getById(teamId: string): Observable<UIClientTeam> {
        const url = `${this.url}/${teamId}`;
        return super.getOne(url);
    }

    getByIdAndUpdateCache(team: UIClientTeam): Observable<UIClientTeam> {
        const url = `${this.url}/${team.model.id}`;
        return new Observable<UIClientTeam>((observer) => {
            return super.getOne(url).subscribe((teamDetails) => {
                for (let i=0; i < this.cache.length; i++) {
                    let cacheTeam = this.cache[i];
                    if (cacheTeam.model.id === teamDetails.model.id) {
                        this.cache[i] = teamDetails;
                        observer.next(teamDetails);
                        observer.complete();
                        break;
                    }
                }
            }, err => this.plateErrorHandler.error(err, 'getByIdAndRefresh team'));
        });
    }

    create(object: UIClientTeam): Observable<UIClientTeam> {
        const url = `${this.url}`;
        return super.create_(object.model, url);
    }

    update(object: UIClientTeam): Observable<string> {
        const url = `${this.url}/${object.model.id}`;
        return super.update_(object.model, url);
    }

    saveTeamMember(team: UIClientTeam, member: UIClientTeamMember): Observable<string> {
        const url = this.url + '/' + team.model.id + '/members/' + member.model.id;
        return this.authHttp.put(url, <any>{
            id: member.model.id,
            role: member.model.roleForTeam
        })
            .map((res) => {
                if (res) {
                    return res.text();
                }
                return null;
            });
    }

    removeTeamMember(team: UIClientTeam, member: UIClientTeamMember): Observable<string> {
        const url = this.url + '/' + team.model.id + '/members/' + member.model.id;
        return this.authHttp.delete(url)
            .map((res) => {
                if (res) {
                    return res.text();
                }
                return null;
            });
    }

    invite (team: UIClientTeam, email: string): Observable<ClientTeamInvitation> {
        const url = this.url + '/' + team.model.id + '/invitations/';
        return this.authHttp.post(url, <any>{
            email: email
        }).map((res) => {
            if (res) {
                let clientTeamInvitation: ClientTeamInvitation = res.json();
                team.model.invitees.push(clientTeamInvitation);
                return clientTeamInvitation;
            }
            return null;
        });
    }

    deleteTeamInvitation(team: UIClientTeam, invitation: ClientTeamInvitation): Observable<string> {
        for (let i = 0; i < team.model.invitees.length; i++) {
            let invitee = team.model.invitees[i];
            if (invitee.id === invitation.id) {
                team.model.invitees.splice(i, 1);
                break;
            }
        }
        const url = this.url + '/' + invitation.teamId + '/invitations/' + invitation.id;
        return this.authHttp.delete(url, <any>{
            email: invitation.inviteeEmail
        }).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    getPurchaseDetailsForPlateBusiness(user: LoggedInUser, team: UIClientTeam): Observable<ClientPlateBusinessPaymentDetails> {
        const url = this.url + '/' + team.model.id + '/plate-business/payment';
        return this.authHttp.get(url)
            .map((res) => {
                if (res) {
                    return res.json();
                }
                return null;
            });
    }

    savePlateBusinessPermissions(team: UIClientTeam): Observable<string> {
        const url = this.url + '/' + team.model.id + '/plate-business/permissions';
        return this.authHttp.post(url, {
            permissions: team.model.plateBusiness.permissions
        })
            .map((res) => {
                if (res) {
                    return res.text();
                }
                return null;
            });
    }

}









