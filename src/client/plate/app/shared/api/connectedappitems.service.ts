import {Injectable} from "@angular/core";
import { Observable } from 'rxjs/Observable';
import { PlateBaseService } from './platebase.service'
import { AuthHttp } from 'angular2-jwt';

interface ClientConnectedAppItem {
    title: string,
    subtitle: string,
    text: string,
    connectedId: string,
    connectedAppId: string,
    id?: string,
    owner?: string,
    created?: number
}

export interface UIClientConnectedAppItem {
    model: ClientConnectedAppItem;
}

@Injectable()
export class ConnectedAppItemsService extends PlateBaseService<UIClientConnectedAppItem> {

    private baseUrl = '/api/users/';
    protected url = null;

    constructor(protected authHttp: AuthHttp){
        super(authHttp);
    }

    transformForUI (connectedAppItem: ClientConnectedAppItem): UIClientConnectedAppItem {
        return {
            model: connectedAppItem
        }
    }

    get (id?: string, refresh?: boolean, userId?: string, connectedAppId?: string): Observable<UIClientConnectedAppItem[] | UIClientConnectedAppItem> {
        this.url = this.baseUrl + userId + '/connectedapps/' + connectedAppId + '/items';
        return <Observable<UIClientConnectedAppItem[] | UIClientConnectedAppItem>>super.get(id, refresh);
    }

    save (connectedApp: UIClientConnectedAppItem, userId?: string, connectedAppId?: string): Observable<UIClientConnectedAppItem[] | UIClientConnectedAppItem> {
        this.url = this.baseUrl + userId + '/connectedapps/' + connectedAppId + '/items';
        return <Observable<UIClientConnectedAppItem[] | UIClientConnectedAppItem>>super.save(<any>connectedApp.model);
    }

}