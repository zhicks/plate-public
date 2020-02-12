import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {AuthHttp} from "angular2-jwt";
import {PlateBaseService} from "./platebase.service";
import {UIClientPlate, ClientPlate} from "./plate.model";
import {PlateLocalStorageService} from "../utils/platelocalstorage.service";
import {PlatterService, UIClientPlatter} from "./platter.service";
import {PlateComponent} from "../../+plates/native/plate.component";
import {ClientPermissionUserType} from "./teams.service";

export interface ClientPlatePermissions {
    cPltIms?: ClientPermissionUserType,
    mPltIms?: ClientPermissionUserType,
    moveImToDiff?: ClientPermissionUserType,
    aPltIms?: ClientPermissionUserType
}

export const BuiltInColors = [
    '#0066CC',
    '#DB2828',
    '#F2711C',
    '#FBBD08',
    '#B5CC18',
    '#21BA45',
    '#00B5AD',
    '#2185D0',
    '#6435C9',
    '#A333C8',
    '#E03997',
    '#A5673F',
    '#767676',
    '#1B1C1D'
]

@Injectable()
export class PlatesService extends PlateBaseService<UIClientPlate> {

    protected url = null;
    private baseUrl = '/api/users/';

    constants = {
        DefaultPlateColor: '#0066CC'
    }

    private openPlateComponents: {
        [plateId: string]: PlateComponent
    } = { }

    constructor(
        protected authHttp: AuthHttp,
        private plateLocalStorageService: PlateLocalStorageService
    ){
        super(authHttp);
    }

    getFromCache(id: string): UIClientPlate {
        for (let item of this.cache) {
            if (item.model.id === id) {
                return item;
            }
        }
        return null;
    }

    addToCache(plate: UIClientPlate, platterService: PlatterService) {
        this.cache.push(plate);
        if (platterService) {
            for (let platter of platterService.cache) {
                if (platter.model.id === plate.model.platter) {
                    platter.plates.insert(plate, plate.model.listPos);
                    plate.platter = platter;
                    break;
                }
            }
        }
    }

    removeFromCacheForPlatterRemoval(platterId: string) {
        let i = this.cache.length;
        while (i--) {
            if (this.cache[i].model.platter === platterId) {
                this.cache.splice(i, 1);
            }
        }
    }

    updateFromSocket(plate: ClientPlate, platterService: PlatterService) {
        let uiClientPlate: UIClientPlate = null;
        for (let cachePlate of this.cache) {
            if (cachePlate.model.id === plate.id) {
                uiClientPlate = cachePlate;
                break;
            }
        }
        if (uiClientPlate) {
            uiClientPlate.model.headers = plate.headers;
            uiClientPlate.model.color = plate.color;
            uiClientPlate.model.name = plate.name;
        }
        // this.cache.push(plate);
        // for (let platter of platterService.cache) {
        //     if (platter.model.id === plate.model.platter) {
        //         platter.plates.push(plate);
        //         plate.platter = platter;
        //         break;
        //     }
        // }
    }

    registerOpenPlateComponent(id: string, component: PlateComponent) {
        this.openPlateComponents[id] = component;
    }

    unregisterOpenPlateComponent(id: string) {
        delete this.openPlateComponents[id];
    }

    transformForUI (plate: ClientPlate): UIClientPlate {
        return new UIClientPlate(plate, this.plateLocalStorageService);
    }

    get (id?: string, refresh?: boolean, userId?: string): Observable<UIClientPlate[] | UIClientPlate> {
        if (userId) {
            this.url = this.baseUrl + userId + '/plates';
        }
        return <Observable<UIClientPlate[] | UIClientPlate>>super.get(id, refresh);
    }

    getForPlatterId(userId: string, platterId: string): Observable<UIClientPlate[]> {
        const url = this.baseUrl + userId + '/platters/' + platterId + '/plates';
        return new Observable<UIClientPlate[]>((observer) => {
            this.authHttp.get(url).map((res) => {
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe((clientPlates: ClientPlate[]) => {
                let ret: UIClientPlate[] = [];
                for (let clientPlate of clientPlates) {
                    ret.push(this.transformForUI(clientPlate));
                }
                observer.next(ret);
                observer.complete();
            })
        });
    }

    movePlateToNewPlatter(plate: UIClientPlate, oldPlatter: UIClientPlatter) {
        const url = '/api/plates/' + plate.model.id + '/move-platter';
        let move = {
            newPlatterId: plate.model.platter,
            oldPlatterPositions: oldPlatter.plates.getIdsAndPositions(),
            newPlatterPositions: plate.platter.plates.getIdsAndPositions()
        }
        return this.authHttp.put(url, { move: move }).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    updateDoneHeader(plateId: string, hidden: boolean) {
        const url = this.url + '/' + plateId + '/doneheader';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, <any>{ isHidden: hidden }).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    upgradePlattersIfNeeded(userId: string) {
        const url = this.baseUrl + userId + '/plates/assignplatters';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.post(url, <any>{}).map((res) => {
            if (res) {
                // Just a status code
                return res.text();
            }
            return null;
        });
    }

    fullyHideDoneHeaderToggle(userId: string, plateId: string, isFullyHidden: boolean) {
        const url = `${this.baseUrl}${userId}/plates/${plateId}/fullhidedoneheader`;
        return this.genericPut(url, { isFullyHidden: isFullyHidden });
    }

    toggleItemsCanBeMarkedAsDone(userId: string, plateId: string, headerId: string, itemsCanBeDone: boolean) {
        const url = `${this.baseUrl}${userId}/plates/${plateId}/headers/${headerId}/itemscanbedone`;
        return this.genericPut(url, { itemsCanBeDone: itemsCanBeDone });
    }

    updateHeaderName(userId: string, plateId: string, headerId: string, name: string) {
        const url = `${this.baseUrl}${userId}/plates/${plateId}/headers/${headerId}/name`;
        return this.genericPut(url, { name: name });
    }

    createHeader(userId: string, plateId: string, name: string) {
        const url = `${this.baseUrl}${userId}/plates/${plateId}/headers`;
        return this.authHttp.post(url, <any>{name: name}).map((res) => {
            if (res) {
                return res.json();
            }
            return null;
        });
    }

    deleteHeader(userId: string, plateId: string, headerId: string) {
        const url = `${this.baseUrl}${userId}/plates/${plateId}/headers/${headerId}`;
        return this.authHttp.delete(url).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    // Sloppy until we upgrade to new api sender
    private genericPut(url, obj) {
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, obj).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }

    /**
     * Get the Plate component if its open - usually to access its items.
     */
    getPlateComponentIfOpen(plateId: string) {
        return this.openPlateComponents[plateId];
    }
}











