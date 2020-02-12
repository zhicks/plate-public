import {Injectable} from "@angular/core";
import {ClientUtil} from "../../../../shared/scripts/util.service";

@Injectable()
export class PlateLocalStorageService {

    cache: {
        [key: string]: string[];
    } = {};

    public Keys = {
        OPEN_BASE_PLATES: 'open_base_plates',
        DOCKED_BASE_PLATES: 'docked_base_plates',
        MINIMIZED_BASE_PLATES: 'minimized_base_plates',
        PINNED_BASE_PLATES: 'pinned_base_plates'
    }

    public getSingleString(key: string) {
        try {
            let item = localStorage.getItem(key);
            return item;
        } catch (e) {
            localStorage.removeItem(key);
            return null;
        }
    }

    public setSingleString(key: string, value: string) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            localStorage.removeItem(key);
            return null;
        }
    }

    public getArray(key: string) {
        try {
            let arr = JSON.parse(localStorage.getItem(key)) || [];
            if (!this.cache[key]) {
                this.cache[key] = [];
            }
            ClientUtil.replaceContentsOfArray(this.cache[key], arr);
            return arr;
        } catch (e) {
            localStorage.removeItem(key);
            return [];
        }
    }

    public setArray(key: string, arrayValue: any[]) {
        try {
            localStorage.setItem(key, JSON.stringify(arrayValue));
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

    public insertInArray(key: string, index: number, item: string) {
        try {
            let arr = [];
            if (localStorage.getItem(key)) {
                arr = JSON.parse(localStorage.getItem(key));
            }
            if (arr.indexOf(item) > -1) {
                // Duplicate, do nothing
            } else {
                arr.splice(index, 0, item);
                ClientUtil.replaceContentsOfArray(this.cache[key], arr);
                localStorage.setItem(key, JSON.stringify(arr));
            }
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

    public removeInArray(key: string, item: string) {
        try {
            let arr = JSON.parse(localStorage.getItem(key));
            arr.splice(arr.indexOf(item), 1);
            ClientUtil.replaceContentsOfArray(this.cache[key], arr);
            localStorage.setItem(key, JSON.stringify(arr));
        } catch (e) {
            localStorage.removeItem(key);
        }
    }

}