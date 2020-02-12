import {Injectable} from "@angular/core";
import { Observable } from 'rxjs/Observable';
import { AuthHttp } from 'angular2-jwt';
import {NewBaseApiService} from "./platebase.service";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {UIClientPlate} from "./plate.model";
import {TeamsService, UIClientTeam, ClientPermissionUserType, Permissions} from "./teams.service";
import {PlatesService, ClientPlatePermissions} from "./plates.service";
import {LoggedInUser, ClientUserTeamReference} from "../../../../shared/scripts/auth.service";
import {ListPositionArray} from "../../../../shared/scripts/util.service";

export interface ClientPlatterPlateBusinessDetails {
    inviteOnly: boolean;
    members: string[];
    permissions: ClientPlatterPermissions;
}

export interface ClientPlatterPermissions extends ClientPlatePermissions {
    cPlts?: ClientPermissionUserType,
    mPlts?: ClientPermissionUserType,
    aPlts?: ClientPermissionUserType
}

export interface ClientPlatter {
    name: string;
    owner: string;
    team: string;
    expanded: boolean;
    id?: string;
    color?: string;
    modified?: number;
    created?: number;
    archived?: boolean;
    plateBusiness?: ClientPlatterPlateBusinessDetails;
}

export class UIClientPlatter {
    plates: ListPositionArray<UIClientPlate> = new ListPositionArray<UIClientPlate>();
    team: UIClientTeam;
    editName = '';
    editCanChangePermissions = false;
    editTeam: UIClientTeam = null;
    editIsInviteOnly: boolean = false;
    editPermissions: ClientPlatterPermissions = {};
    lazyTeamRef: ClientUserTeamReference = null;
    constructor(
        public model: ClientPlatter
    ) {
        if (!this.model.plateBusiness) {
            this.model.plateBusiness = {
                inviteOnly: false,
                members: [],
                permissions: {}
            };
        }
    }

    lazilySetTeamReference(user: LoggedInUser) {
        if (this.lazyTeamRef) {
            return;
        }
        if (!this.team) {
            return;
        }
        let teamReferences = user.teams;
        for (let userTeam of teamReferences) {
            if (userTeam.id === this.team.model.id) {
                this.lazyTeamRef = userTeam;
                break;
            }
        }
    }

    private checkPermissionForBusiness(user: LoggedInUser, team: UIClientTeam, permission: ClientPermissionUserType) {
        let userPermission = ClientPermissionUserType.Regular;
        if (team.model.owner === user.id) {
            userPermission = ClientPermissionUserType.Owner;
        } else if (this.lazyTeamRef && this.lazyTeamRef.role === 'admin') {
            userPermission = ClientPermissionUserType.Admin;
        }
        return Permissions.checkPermission(userPermission, permission);
    }

    canAddPlates(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.cPlts;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.cPlts;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canModifyPlates(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.mPlts;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.mPlts;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canArchivePlates(user: LoggedInUser) {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.aPlts;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.aPlts;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canCreatePlateItems(user: LoggedInUser): boolean {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.cPltIms;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.cPltIms;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canModifyPlateItems(user: LoggedInUser): boolean {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.mPltIms;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.mPltIms;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canArchivePlateItems(user: LoggedInUser): boolean {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.aPltIms;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.aPltIms;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }

    canMovePlateItemsToDiffPlate(user: LoggedInUser): boolean {
        this.lazilySetTeamReference(user);
        if (!this.team || !this.team.isPlateBusiness) {
            return true;
        } else {
            let permission = this.model.plateBusiness.permissions.moveImToDiff;
            if (!permission) {
                permission = this.team.model.plateBusiness.permissions.moveImToDiff;
            }
            return this.checkPermissionForBusiness(user, this.team, permission);
        }
    }
}

@Injectable()
export class PlatterService extends NewBaseApiService<ClientPlatter, UIClientPlatter> {

    private itemUrl = '/api/platters'; // /:id/plates
    private userBaseUrl = '/api/users';

    constants = {

    }

    constructor(
        protected authHttp: AuthHttp,
        private plateErrorHandler: PlateErrorHandlerService,
        private teamsService: TeamsService,
        private platesService: PlatesService
    ){
        super(authHttp);
    }

    transformForUI (platter: ClientPlatter): UIClientPlatter {
        return new UIClientPlatter(platter);
    }

    addToCache(platter: UIClientPlatter) {
        this.cache.push(platter);
    }

    updateFromSocket(platter: UIClientPlatter) {
        let uiClientPlatter: UIClientPlatter = null;
        for (let cachePlatter of this.cache) {
            if (cachePlatter.model.id === platter.model.id) {
                uiClientPlatter = cachePlatter;
                break;
            }
        }
        if (uiClientPlatter) {
            uiClientPlatter.model.color = platter.model.color;
            uiClientPlatter.model.name = platter.model.name;
            if (platter.model.archived) {
                this.removeFromCache(platter.model.id);
            }
        }
    }

    removeFromCache(platterId: string) {
        for (let i=0; i < this.cache.length; i++) {
            let cachePlatter = this.cache[i];
            if (cachePlatter.model.id === platterId) {
                this.cache.splice(i, 1);
                this.platesService.removeFromCacheForPlatterRemoval(cachePlatter.model.id);
                break;
            }
        }
    }

    movePlateSamePlatter(platter: UIClientPlatter) {
        const url = `${this.itemUrl}/${platter.model.id}/plate-positions`;
        let positions = platter.plates.getIdsAndPositions();
        return this.authHttp.put(url, { positions: positions}).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    // getById(plateItemId: string, commentId: string): Observable<UIClientPlateItemComment> {
    //     const url = `${this.baseUrl}/${plateItemId}/comments/${commentId}`;
    //     return super.getOne(url);
    // }

    get(userId: string): Observable<UIClientPlatter[]> {
        const url = `${this.userBaseUrl}/${userId}/platters`;
        return super.getMultiple(url);
    }

    setExpanded(platter: UIClientPlatter): Observable<string> {
        const url = `${this.itemUrl}/${platter.model.id}/expanded`;
        return super.update_({expanded: platter.model.expanded}, url);
    }

    create(object: UIClientPlatter, userId: string): Observable<UIClientPlatter> {
        const url = `${this.userBaseUrl}/${userId}/platters`;
        return super.create_(object.model, url);
    }

    update(object: UIClientPlatter): Observable<string> {
        const url = `${this.itemUrl}/${object.model.id}`;
        return super.update_(object.model, url);
    }

    delete(object: ClientPlatter): Observable<string> {
        object.archived = true;
        return new Observable<string>((observer) => {
            const url = `${this.itemUrl}/${object.id}/archive`;
            super.update_({}, url).subscribe((status) => {
                for (let i=0; i < this.cache.length; i++) {
                    if (this.cache[i].model.id === object.id) {
                        this.cache.splice(i, 1);
                        observer.next(status);
                        observer.complete();
                        break;
                    }
                }
            }, err => this.plateErrorHandler.error(err, 'in delete platter service'));
        });
    }

}











