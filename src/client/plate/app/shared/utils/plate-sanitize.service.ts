declare const html_sanitize; // Caja
import {Injectable} from "@angular/core";

@Injectable()
export class PlateSanitizeService {

    // https://github.com/mapbox/sanitize-caja/blob/master/index.js
    private cleanUrl(url) {
        if (/^https?/.test(url.getScheme())) return url.toString();
        if (/^mailto?/.test(url.getScheme())) return url.toString();
        if ('data' == url.getScheme() && /^image/.test(url.getPath())) {
            return url.toString();
        }
    }

    constructor(

    ) { }

    sanitize(str: string): string {
        return html_sanitize(str, this.cleanUrl);
    }
}