import {Observable} from "rxjs/Observable";
import {AuthHttp} from "angular2-jwt";

export interface PlateBaseObject {
    id?: string;
}

export interface BaseApiObject {
    id?: string;
}
export interface UIBaseApiObject<T extends BaseApiObject> {
    model: T;
}

export abstract class PlateBaseService<T extends PlateBaseObject> {
    protected url: string;

    public cache: T[] = [];

    transformForUI(object: any): T {
        return object;
    };

    constructor(
        protected authHttp: AuthHttp
    ){}

    get (id?: string, refresh?: boolean): Observable<T | T[]> {
        if (id) {
            return new Observable<T[]>((observer) => {
                const url = this.url + '/' + id;
                //noinspection TypeScriptUnresolvedFunction
                return this.authHttp.get(url)
                    .map((res) => {
                        if (res) {
                            return res.json();
                        }
                        return null;
                    })
                    .subscribe((object) => {
                        const transformedObject = this.transformForUI(object);
                        observer.next(transformedObject);
                        observer.complete();
                    }, err => {
                        observer.error(err);
                        observer.complete();
                    })
                    ;
            });
        } else {
            return new Observable<T[]>((observer) => {
                //noinspection TypeScriptUnresolvedFunction
                this.authHttp.get(this.url)
                    .map((res) => {
                        if (res) {
                            return res.json();
                        }
                        return null;
                    }).subscribe((objects) => {
                        while (this.cache.length)
                            this.cache.pop();

                        let transformedObjects = [];
                        for (let i = 0; i < objects.length; i++) {
                            const transformedObject = this.transformForUI(objects[i]);
                            transformedObjects.push(transformedObject)
                            this.cache.push(transformedObject);
                        }
                        observer.next(transformedObjects);
                        observer.complete();
                    }, err => {
                        observer.error(err);
                        observer.complete();
                });
            });

        }
    }

    save (object: T): Observable<any> {
        if (object.id) {
            // ------------------------------------------------ Update / Put
            const url = this.url + '/' + object.id;
            //noinspection TypeScriptUnresolvedFunction
            return this.authHttp.put(url, <any>object).map((res) => {
                if (res) {
                    // Just a status code for put
                    return res.text();
                }
                return null;
            });
        } else {
            // ------------------------------------------------ New / Post
            return new Observable<T[]>((observer) => {
                //noinspection TypeScriptUnresolvedFunction
                this.authHttp.post(this.url, <any>object).map((res) => {
                    if (res) {
                        return res.json();
                    }
                    return null;
                }).subscribe((object) => {
                    observer.next(this.transformForUI(object));
                    observer.complete();
                });
            });
        }
    }
}

// ------------------------------------------------------------------- NEW! Use this until we get rid of the old one.

export abstract class NewBaseApiService<T extends BaseApiObject, U extends UIBaseApiObject<T>> {
    // The base cache object
    public cache: U[] = [];

    constructor(
        protected authHttp: AuthHttp
    ){}

    // ------------------------------------------------------------------- Client

    transformForUI(object: T): U {
        return <U>{
            model: object
        }
    }

    getFromCache(id: string) {
        for (let item of this.cache) {
            if (item.model.id === id) {
                return item;
            }
        }
        return null;
    }

    // ------------------------------------------------------------------- Server

    protected getOne(url: string) {
        return new Observable<U>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            return this.authHttp.get(url)
                .map((res) => {
                    if (res) {
                        return res.json();
                    }
                    return null;
                })
                .subscribe((object: T) => {
                    const transformedObject = this.transformForUI(object);
                    observer.next(transformedObject);
                    observer.complete();
                });
        });
    }

    protected getMultiple(url: string) {
        return new Observable<U[]>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.authHttp.get(url)
                .map((res) => {
                    if (res) {
                        return res.json();
                    }
                    return null;
                }).subscribe((objects) => {
                    while (this.cache.length)
                        this.cache.pop();

                    let transformedObjects = [];
                    for (let i = 0; i < objects.length; i++) {
                        const transformedObject = this.transformForUI(objects[i]);
                        transformedObjects.push(transformedObject)
                        this.cache.push(transformedObject);
                    }
                    observer.next(transformedObjects);
                    observer.complete();
            });
        });
    }

    protected create_(object: T, url: string) {
        return new Observable<U>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.authHttp.post(url, <any>object).map((res) => {
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe((object) => {
                var transformedObject = this.transformForUI(object);
                this.cache.push(transformedObject);
                observer.next(transformedObject);
                observer.complete();
            });
        });
    }

    protected update_(object: any, url: string) {
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.put(url, object).map((res) => {
            if (res) {
                // Just a status code for put
                return res.text();
            }
            return null;
        });
    }
}







