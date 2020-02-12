import { English } from './English';

export class Resource {
    public static Make (resourceString: string, ...args: any[]) {
        return resourceString.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    }
    public static get Translatable() {
        return English;
    }
}
