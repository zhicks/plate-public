export class PlateUtil {
    static IsDefined(object: any) {
        return object !== undefined && object !== null;
    }
    static getDiffInMinutes(date1: Date, date2: Date) {
        let diffMs = (<any>date1 - <any>date2);
        let diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
        return diffMins;
    }
    static emailIsValid(email: string) {
        var ampersandIndex = email.indexOf('@');
        if (ampersandIndex >= 1) {
            if (email.length > ampersandIndex) {
                var sub = email.substring(ampersandIndex + 1);
                var dotIndex = sub.indexOf('.');
                if (dotIndex > 0) {
                    sub = sub.substring(dotIndex + 1);
                    return sub.length > 0;
                }
            }
        }
        return false;
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
    static decodeBase64(str: string) {
        // This only works on node 6+
        //return Buffer.from(str, 'base64').toString('utf8');
        str = str || '';
        return new Buffer(str, 'base64').toString();
    }
}