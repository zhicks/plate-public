import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { AuthHttp } from 'angular2-jwt';
import { Http } from '@angular/http';
import {PlateErrorHandlerService} from "../utils/plate-error-handler.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {ConnectedAppsService} from "./connectedapps.service";
import {ClientPlateItem, UIClientPlateItem, PlateItemsService} from "./plateitems.service";
import {PlatesService} from "./plates.service";
import {ISearchableBasePlateComponent} from "../../+plates/baseplate.component";
import {ClientConnectedAppType, UIClientConnectedApp} from "./connectedapp.model";
import {UIClientPlate} from "./plate.model";
import {EditingPlateItemService} from "../../+plates/native/item-edit/editing-plate-item.service";
import {HomePlateService} from "../../+home/homeplate.service";

export interface PlateSearchResultsWithSize {
    results: ClientPlateItem[];
    resultSizeEstimate: number;
}
export interface ConnectedAppSearchResultsWithSize {
    searchResultsNoIcon: SearchResultNoIcon[];
    resultSizeEstimate: number;
}
export interface SearchResultNoIcon {
    id: string;
    type: ClientConnectedAppType;
    model: any;
    iconFileType: string;
    title: string;
    detailOne: string;
    detailTwo: string;
    snippet: string;
    timestamp: number;
    basePlateInstanceId: string;
}

export interface SearchResult extends SearchResultNoIcon {
    icon: string;
}

export interface SearchOptions {
    // NOTE - These are gmail specific! Change later
    maxResults?: number;
    q?: string; // Don't specify this manually - taken care of by gmail service
    id?: string;
}

export interface SearchServiceCache {
    [resultName: string]: SearchServiceCacheObject
}

export interface SearchServiceCacheObject {
    results: SearchResult[]
    resultSizeEstimate: number
    name: string
    type: ClientConnectedAppType
}

interface SearchEventListeners {
    [id: string]: ISearchableBasePlateComponent
}

interface SearchEventQueue {
    [componentId: string]: {
        result: SearchResult,
        callback: Function
    }
}

@Injectable()
export class PlateMasterSearchService {
    eventListeners: SearchEventListeners = {};
    eventQueue: SearchEventQueue = {};
}

@Injectable()
export class PlateSearchService {
    private baseUrl = '/api/search';
    cache: SearchServiceCache = {};
    eventListeners: SearchEventListeners;
    eventQueue: SearchEventQueue;

    constructor(
        private authHttp: AuthHttp,
        private searchMasterService: PlateMasterSearchService,
        private plateErrorHandler: PlateErrorHandlerService,
        private clientUtil: ClientUtil,
        private connectedAppsService: ConnectedAppsService, // Provided by AppComponent, will have a reference to all current ConnectedApps
        private platesService: PlatesService,
        private http: Http,
        private editingPlateItemService: EditingPlateItemService,
        private plateItemsService: PlateItemsService,
        private homePlateService: HomePlateService
    ){
        this.eventListeners = this.searchMasterService.eventListeners;
        this.eventQueue = this.searchMasterService.eventQueue;
    }

    /**
     * Progressively updates the cache object upon each call, which callers should grab a reference to.
     * clearSearch() should be called before initiating a new search.
     * Observer completes after getting a callback from the server and from all connected apps.
     * If no search options, does the search that you would see in the top bar.
     * @param query
     * @returns {Observable<boolean>}
     */
    search(query: string, userId: string, options?: SearchOptions) {
        return new Observable<boolean>((observer) => {

            let searchCount = 0;
            const numSearchesNeededToComplete = this.connectedAppsService.cache.length + 1;

            // For now we just replace the entire cache object
            this.clearSearch();

            query = `?query=${query}`;
            if (options) {
                if (options.maxResults) {
                    query += `&maxResults=${options.maxResults}`;
                }
            }

            // Search for native plate items
            const url = this.baseUrl + query;
            //noinspection TypeScriptUnresolvedFunction
            this.authHttp.get(url).map(res => res.json())
                .subscribe((rawResults: PlateSearchResultsWithSize) => {
                    let results: SearchResult[] = [];
                    if (rawResults && rawResults.results && rawResults.results.length) {
                        for (let raw of rawResults.results) {
                            let plate = this.platesService.getFromCache(raw.plate);
                            results.push({
                                id: raw.id,
                                basePlateInstanceId: raw.plate,
                                type: ClientConnectedAppType.Native,
                                model: raw,
                                icon: this.connectedAppsService.getConnectedAppIcon(ClientConnectedAppType.Native),
                                iconFileType: 'svg',
                                title: '',
                                detailOne: 'Plate Item',
                                detailTwo: raw.title,
                                snippet: plate ? `In ${plate.model.name}` : '',
                                timestamp: raw.modified
                            });
                        }
                        let cacheIdentifier = this.connectedAppsService.getAppNameForType(ClientConnectedAppType.Native);
                        this.cache[cacheIdentifier] = this.cache[cacheIdentifier] || {
                                results: [],
                                resultSizeEstimate: rawResults.resultSizeEstimate || 0,
                                name: cacheIdentifier,
                                type: ClientConnectedAppType.Native
                            };
                        ClientUtil.pushArray(this.cache[cacheIdentifier].results, results);
                    }
                    observer.next(true);
                    searchCount++;
                    if (searchCount >= numSearchesNeededToComplete) {
                        observer.complete();
                    }
                }, error => this.plateErrorHandler.error(error, 'in search first get'));

            // Search in connected apps
            for (let connectedApp of this.connectedAppsService.cache) {
                this.connectedAppsService.search(userId, connectedApp, query).subscribe((rawResults: ConnectedAppSearchResultsWithSize) => {
                    if (rawResults && rawResults.searchResultsNoIcon) {
                        for (let raw of rawResults.searchResultsNoIcon) {
                            let rawAsSearchResult = <SearchResult>raw;
                            rawAsSearchResult.icon = this.connectedAppsService.getConnectedAppIcon(raw.type);
                            if (raw.type === ClientConnectedAppType.Gmail) {
                                raw.snippet = raw.snippet && ClientUtil.decodeHtmlEntities(raw.snippet);
                            }
                            let cacheIdentifier = this.connectedAppsService.getAppNameForType(raw.type);
                            cacheIdentifier = `${cacheIdentifier} - ${raw.detailOne}`;
                            this.cache[cacheIdentifier] = this.cache[cacheIdentifier] || {
                                    results: [],
                                    resultSizeEstimate: 0,
                                    name: cacheIdentifier,
                                    type: raw.type
                                };
                            this.cache[cacheIdentifier].results.push(rawAsSearchResult);
                            this.cache[cacheIdentifier].resultSizeEstimate = rawResults.resultSizeEstimate || 0;
                        }
                    }
                    observer.next(true);
                    searchCount++;
                    if (searchCount >= numSearchesNeededToComplete) {
                        observer.complete();
                    }
                }, error => {
                    this.plateErrorHandler.error(error, `connected app search for ${connectedApp.model.type}`);
                    searchCount++;
                });
            }
        });
    }

    clearSearch() {
        console.log('clearing cache');
        for (let key in this.cache) {
            delete this.cache[key];
        }
    }

    getSearchObjects() {
        return Object.values(this.cache);
    }

    getMin(a: number, b: number) {
        return Math.min(a, b);
    }

    /**
     * Registers for search result clicked event. Checks the event queue to see if
     * an item was clicked before the component popped into existence.
     * @param component
     */
    registerForEvent(component: ISearchableBasePlateComponent) {
        let id = component.base.model.id;
        this.eventListeners[id] = component;
        if (this.eventQueue[id]) {
            component.searchResultClicked(this.eventQueue[id].result, this.eventQueue[id].callback);
            delete this.eventQueue[id];
        }
    }

    /**
     * Should be called on ngAfterViewInit for the component if registerForEvent was called.
     * @param component
     */
    unregisterForEvent(component: ISearchableBasePlateComponent) {
        delete this.eventListeners[component.base.model.id];
    }

    /**
     * Calls the event on the component if it's available.
     * If not, places it into queue, and the component will ask for it later.
     * @param componentId
     * @param result
     */
    private callOrQueueSearchResultClick(componentId: string, result: SearchResult, callback?) {
        if (this.eventListeners[componentId]) {
            this.eventListeners[componentId].searchResultClicked(result, callback);
        } else {
            this.eventQueue[componentId] = {
                result: result,
                callback: callback
            };
        }
    }

    searchResultClicked(result: SearchResult) {
        let basePlateInstanceId = result.basePlateInstanceId;
        let isConnectedApp = result.type !== ClientConnectedAppType.Native;
        if (!isConnectedApp) {
            let openPlate: UIClientPlate = null;
            for (let plate of this.platesService.cache) {
                if (plate.model.id === basePlateInstanceId) {
                    openPlate = plate;
                    break;
                }
            }
            if (openPlate && openPlate.getSelected()) {
                // If the Plate exists and is open, go ahead and grab the item - we'll update the model
                // that way. Otherwise we would make an edit and it would not be reflected in the open Plate -
                // it would have to be refreshed.
                this.callOrQueueSearchResultClick(basePlateInstanceId, result, (uiClientPlateItem: UIClientPlateItem) => {
                    let plate = this.platesService.getFromCache(uiClientPlateItem.model.plate);
                    this.editingPlateItemService.setItem(uiClientPlateItem, plate.model.color, 'Item', true);
                });
            } else {
                // The plate was not open
                let uiClientPlateItem: UIClientPlateItem = this.plateItemsService.transformForUI(result.model);
                let plate = this.platesService.getFromCache(uiClientPlateItem.model.plate);
                this.editingPlateItemService.setItem(uiClientPlateItem, plate.model.color, 'Item', true);
            }

        } else {
            let selectedConnectedApp: UIClientConnectedApp = null;
            for (let connectedApp of this.connectedAppsService.cache) {
                if (connectedApp.model.id === basePlateInstanceId) {
                    selectedConnectedApp = connectedApp;
                    break;
                }
            }
            selectedConnectedApp.select(true, false, this.homePlateService);
            this.callOrQueueSearchResultClick(basePlateInstanceId, result);
        }
    }

}