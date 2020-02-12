import {Injectable} from "@angular/core";
import { Observable } from 'rxjs/Observable';
import { AuthHttp } from 'angular2-jwt';
import {NewBaseApiService} from "./platebase.service";
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";

export interface ClientPlateItemComment {
    content: string;
    item: string;
    ownerName: string;
    id?: string;
    modified?: number;
    created?: number;
    owner?: string;
    archived?: boolean;
}

export class UIClientPlateItemComment {
    editing = false;
    constructor(
        public model: ClientPlateItemComment
    ) { }
}

@Injectable()
export class PlateItemCommentsService extends NewBaseApiService<ClientPlateItemComment, UIClientPlateItemComment> {

    private baseUrl = '/api/plateitems'; // /:id/comments/:commentId

    constants = {

    }

    constructor(
        protected authHttp: AuthHttp,
        private plateErrorHandler: PlateErrorHandlerService
    ){
        super(authHttp);
    }

    transformForUI (comment: ClientPlateItemComment): UIClientPlateItemComment {
        return new UIClientPlateItemComment(comment);
    }

    getById(plateItemId: string, commentId: string): Observable<UIClientPlateItemComment> {
        const url = `${this.baseUrl}/${plateItemId}/comments/${commentId}`;
        return super.getOne(url);
    }

    get(plateItemId: string): Observable<UIClientPlateItemComment[]> {
        const url = `${this.baseUrl}/${plateItemId}/comments`;
        return super.getMultiple(url);
    }

    create(object: ClientPlateItemComment, plateItemId: string): Observable<UIClientPlateItemComment> {
        const url = `${this.baseUrl}/${plateItemId}/comments`;
        return super.create_(object, url);
    }

    update(object: ClientPlateItemComment, plateItemId: string, commentId: string): Observable<string> {
        const url = `${this.baseUrl}/${plateItemId}/comments/${commentId}`;
        return super.update_(object, url);
    }

    delete(object: ClientPlateItemComment, plateItemId: string, commentId: string): Observable<string> {
        return new Observable<string>((observer) => {
            const url = `${this.baseUrl}/${plateItemId}/comments/${commentId}`;
            super.update_(object, url).subscribe((status) => {
                for (let i = 0; i < this.cache.length; i++) {
                    let item = this.cache[i];
                    if (item.model.id === commentId) {
                        this.cache.splice(i, 1);
                        observer.next(status);
                        observer.complete();
                        break;
                    }
                }
            }, err => this.plateErrorHandler.error(err, 'in delete comment service'));
        });
    }

}











