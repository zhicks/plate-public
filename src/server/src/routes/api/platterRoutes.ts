import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {platterController} from '../../controllers/platter-controller'

class PlatterRoutes implements ApiRoutes {
    url = '/platters';

    routesGet: ApiRoute[] = [

    ]

    routesPut: ApiRoute[] = [
        {
            route: '/:platterId',
            callback: platterController.updatePlatter
        },
        {
            route: '/:platterId/expanded',
            callback: platterController.setExpanded
        },
        {
            route: '/:platterId/archive',
            callback: platterController.archive
        },
        {
            route: '/:platterId/plate-positions',
            callback: platterController.updatePlatePositions
        }
    ];

    routesPost: ApiRoute[] = [

    ];

    routesDelete: ApiRoute[] = [

    ];
}

export const platterRoutes = new PlatterRoutes();

