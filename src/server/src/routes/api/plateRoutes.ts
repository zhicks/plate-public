import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {platesController} from '../../controllers/plates-controller'

class PlateRoutes implements ApiRoutes {
    url = '/plates';

    routesGet: ApiRoute[] = [
        {
            route: '/:id/items',
            callback: platesController.getItems
        }
    ]

    routesPut: ApiRoute[] = [
        {
            route: '/:id/move-platter',
            callback: platesController.movePlateToPlatter
        }
    ];

    routesPost: ApiRoute[] = [
        {
            route: '/:id/items',
            callback: platesController.createItem
        }
    ];

    routesDelete: ApiRoute[] = [

    ];
}

export const plateRoutes = new PlateRoutes();

