declare const Stripe;

import { Injectable } from '@angular/core';

export interface ListPositionObject {
    model: {
        id?: string;
        listPos: number;
    }
}
export interface ListPositionArrayIdAndPos {
    id: string;
    listPos: number;
}
export class ListPositionArray<T extends ListPositionObject> extends Array<T> {

    getMap(): {[id: string]: T} {
        let map: {[id: string]: T} = {};
        for (let object of this) {
            map[object.model.id] = object;
        }
        return map;
    }

    applyListPositions(positions: ListPositionArrayIdAndPos[]) {
        let map = this.getMap();
        for (let position of positions) {
            let object = map[position.id];
            if (object) {
                object.model.listPos = position.listPos;
            }
        }
        this.sortByPosition();
    }

    sortByPosition() {
        this.sort((a, b) => {
            let aPos = a.model.listPos;
            let bPos = b.model.listPos;
            if (aPos < bPos) {
                return -1;
            } else if (aPos > bPos) {
                return 1;
            } else {
                return 0;
            }
        })
    }

    updatePositionForItem(object: T, newPos: number) {
        // First find the object
        let objectOldIndex = -1;
        for (let i=0; i < this.length; i++) {
            if (this[i].model.id === object.model.id) {
                objectOldIndex = i;
                break;
            }
        }
        if (objectOldIndex === -1) {
            console.error('Could not find object in array');
        } else {
            if (newPos < objectOldIndex) {
                // If the new position is less than the old position, it moved up.
                // We need to +1 all indexes beneath the new position.
                // Skip the object since we update it later.
                for (let i=newPos; i <= objectOldIndex; i++) {
                    this[i].model.listPos = i+1;
                }
            } else if (objectOldIndex < newPos) {
                // If the old position is less than the new position, it moved down.
                // We need to -1 all indexes between the old and new.
                // Skip the object since we update it later.
                for (let i=objectOldIndex+1; i <= newPos; i++) {
                    if (this[i]) {
                        this[i].model.listPos = i-1;
                    }
                }
            }
            object.model.listPos = newPos;
            // Now sort
            this.sortByPosition();
        }
    }

    assignGenericIndexes() {
        this.sortByPosition();
        let genericIndex = 0;
        for (let i=0; i < this.length; i++) {
            this[i].model.listPos = i;
        }
    }

    remove(object: T) {
        return this.removeById(object.model.id);
    }

    removeById(id: string) {
        let didFindItem = false;
        for (let i=0; i < this.length; i++) {
            if (didFindItem) {
                this[i].model.listPos--;
            } else if (this[i].model.id === id) {
                this.splice(i, 1);
                i-=1;
                didFindItem = true;
            }
        }
    }

    insert(object: T, index: number) {
        index = index || this.length-1;
        this.splice(index, 0, object);
        object.model.listPos = index;
        for (let i=index+1; i < this.length; i++) {
            this[i].model.listPos = i;
        }
    }

    getIdsAndPositions(): ListPositionArrayIdAndPos[] {
        let arr: ListPositionArrayIdAndPos[] = [];
        for (let obj of this) {
            arr.push({
                id: obj.model.id,
                listPos: obj.model.listPos
            })
        }
        return arr;
    }

}

class ClientUtilPayment {
    static creditCardIsValid(value: string) {
        return Stripe.card.validateCardNumber(value);
    }
    static expirationDateIsValid(value: string) {
        if (!value) {
            return false;
        }
        let match=value.match(/^\s*(0?[1-9]|1[0-2])\/(\d\d|\d{4})\s*$/);
        if (!match){
            // Invalid
            return false;
        }
        let exp = new Date(ClientUtilPayment.normalizeYear(1*(<any>match[2])),1*(<any>match[1])-1,1).valueOf();
        let now=new Date();
        let currMonth = new Date(now.getFullYear(),now.getMonth(),1).valueOf();
        if (exp<=currMonth){
            // It's expired
            return false;
        } else {
            return true;
        };
    }
    static cvcIsValid(value: string) {
        return Stripe.card.validateCVC(value);
    }
    static zipIsValid(value: string) {
        // http://stackoverflow.com/questions/160550/zip-code-us-postal-code-validation
        return value && /(^\d{5}$)|(^\d{5}-\d{4}$)/.test(value);
    }

    // Stripe HTTP and key
    static setStripeKey() {
        Stripe.setPublishableKey((<any>window).STRIPE_PUBLISHABLE_KEY);
    }
    static createStripeToken(stripeTokenDetails, callback) {
        Stripe.card.createToken(stripeTokenDetails, (status, response) => {
            callback(status, response);
        })
    }

    private static normalizeYear(year: number) {
        let YEARS_AHEAD = 20;
        if (year<100){
            let nowYear = new Date().getFullYear();
            year += Math.floor(nowYear/100)*100;
            if (year > nowYear + YEARS_AHEAD){
                year -= 100;
            } else if (year <= nowYear - 100 + YEARS_AHEAD) {
                year += 100;
            }
        }
        return year;
    }
    private static isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
}

@Injectable()
export class ClientUtil {

    Constants = {

    }

    static isDefined(obj: any) {
        return !(obj === undefined || obj === null || isNaN(obj));
    }

    static clearArray(arr: any[]) {
        if (arr) {
            while (arr.length)
                arr.pop();
        }
    }

    static moveInArray(arr: any[], oldPosition: number, newPosition: number) {
        arr.splice(newPosition, 0, arr.splice(oldPosition, 1)[0]);
    }

    static replaceContentsOfArray(arrayThatShouldBeEmptied: any[], arrayThatShouldBeCopied: any[]) {
        this.clearArray(arrayThatShouldBeEmptied);
        if (arrayThatShouldBeCopied) {
            for (let i=0; i < arrayThatShouldBeCopied.length; i++) {
                arrayThatShouldBeEmptied.push(arrayThatShouldBeCopied[i]);
            }
        }
    }

    static arraysAreEqual(arr1: any[], arr2: any[]) {
        if(arr1.length !== arr2.length)
            return false;
        for(let i = arr1.length; i--;) {
            if(arr1[i] !== arr2[i])
                return false;
        }
        return true;
    }

    static pushArray(arrayToPushTo: any[], arrayToPush: any[]): void {
        arrayToPushTo = arrayToPushTo || [];
        if (arrayToPush) {
            for (let item of arrayToPush) {
                arrayToPushTo.push(item);
            }
        }
    }

    static getExtensionForFileName(fileName: string) {
        if (fileName && fileName.length) {
            let tokens = fileName.split('.');
            if (tokens && tokens.length > 1) {
                let lastToken = tokens[tokens.length-1];
                return lastToken;
            }
        }
        return null;
    }

    static extensionIsImage(extension: string) {
        if (extension) {
            extension = extension.toLowerCase();
            let isImg = extension === 'png' ||
                extension === 'jpg' ||
                extension === 'jpeg' ||
                extension === 'gif';
            return isImg;
        }
        return false;
    }

    static fileNameIsImage(fileName: string) {
        let extension = ClientUtil.getExtensionForFileName(fileName);
        return ClientUtil.extensionIsImage(extension);
    }

    static truncateDecimal(unRounded: number, nrOfDecimals = 2) {
        if (unRounded) {
            const unroundedString = String(unRounded);
            if (unroundedString) {
                const parts = unroundedString.split(".");
                if (parts.length !== 2) {
                    // without any decimal part
                    return unRounded;
                }
                const newDecimals = parts[1].slice(0, nrOfDecimals),
                    newString = `${parts[0]}.${newDecimals}`;
                return Number(newString);
            }
        } else {
            return 0;
        }
    }

    /**
     * Returns a new instance of an array
     * @param arrayToPushTo
     * @param arrayToPush
     */
    static combineArrays(array1: any[], array2: any[]): any[] {
        let ret = [];
        for (let item of array1) {
            ret.push(item);
        }
        for (let item of array2) {
            ret.push(item);
        }
        return ret;
    }

    static getDiffInMinutes(date1: Date, date2: Date) {
        let diffMs = (<any>date1 - <any>date2);
        let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
        return diffMins;
    }

    static minutesToMs(minutes: number) {
        return minutes * 60 * 1000;
    }

    static findById(id: string, arr: any[]) {
        if (arr) {
            for (let item of arr) {
                if (item.id === id) {
                    return item;
                }
            }
        }
    }

    static getIndexById(id: string, arr: any[]) {
        if (arr) {
            for (let i=0; i < arr.length; i++) {
                let item = arr[i];
                if (item.id === id) {
                    return i;
                }
            }
        }
    }

    static emailIsValid(email: string) {
        const ampersandIndex = email.indexOf('@');
        if (ampersandIndex >= 1) {
            if (email.length > ampersandIndex) {
                let sub = email.substring(ampersandIndex + 1);
                const dotIndex = sub.indexOf('.');
                if (dotIndex > 0) {
                    sub = sub.substring(dotIndex + 1);
                    return sub.length > 0;
                }
            }
        }
        return false;
    }

    static decodeHtmlEntities(html) {
        // http://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it
        if (!html) {
            return null;
        }
        const txt = document.createElement("textarea");
        txt.innerHTML = html;
        return txt.value;
    }

    static copyShallowObject(obj: any) {
        if (!obj) {
            return {};
        }
        let copy: any = {};
        for (let key in obj) {
            copy[key] = obj[key];
        }
        return copy;
    }

    /**
     * Not suitable for GUIDs. For UI purposes only
     */
    static randomString() {
        return Math.random().toString(36).substr(2, 10);
    }

    static payment = ClientUtilPayment;


    // replaceById(arrayToModify: any[], arrayToTakeFrom: any[], addIfExtra: boolean, prune: boolean) {
    //     for (let i = 0; i < arrayToModify.length; i++) {
    //         let item1 = arrayToModify[i];
    //         for (let j = 0; j < arrayToTakeFrom.length; j++) {
    //             let item2 = arrayToTakeFrom[j];
    //             if (item1.id === item2.id) {
    //                 arrayToModify[i] = item2;
    //
    //             }
    //         }
    //     }
    // }

}