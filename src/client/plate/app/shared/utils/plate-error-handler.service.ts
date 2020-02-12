import {Injectable} from "@angular/core";

@Injectable()
export class PlateErrorHandlerService {

    error(error: any, description: string) {
        console.error(error);
        console.log('Description: ' + description);
        if (error) {
            console.error(error.stack);
        }
    }
}