import * as express from "express";

import { userRoutes } from './api/userRoutes';
import { teamRoutes } from './api/teamRoutes';
import { notificationRoutes } from './api/notificationRoutes';
import { plateRoutes } from './api/plateRoutes';
import { connectedAppRoutes } from './api/connectedAppRoutes';
import { plateItemRoutes } from './api/plateItemRoutes';
import { searchRoutes } from './api/searchRoutes';
import { platterRoutes } from './api/platterRoutes';

let apiRoutes: ApiRoutes[] = [];
apiRoutes.push(userRoutes);
apiRoutes.push(teamRoutes);
apiRoutes.push(notificationRoutes);
apiRoutes.push(plateRoutes);
apiRoutes.push(connectedAppRoutes);
apiRoutes.push(plateItemRoutes);
apiRoutes.push(searchRoutes);
apiRoutes.push(platterRoutes);

// --------------------------------------------------

export interface ApiRoute {
    route: string;
    callback: (req, res) => void;
}

export interface ApiRoutes {
    url: string;
    routesGet: ApiRoute[];
    routesPut: ApiRoute[];
    routesPost: ApiRoute[];
    routesDelete: ApiRoute[];
}

function makeRoutesForResource(router, apiRoute: ApiRoutes) {
    for (let route of apiRoute.routesGet)
        router.get(apiRoute.url + route.route, route.callback);
    for (let route of apiRoute.routesPut)
        router.put(apiRoute.url + route.route, route.callback);
    for (let route of apiRoute.routesPost)
        router.post(apiRoute.url + route.route, route.callback);
    for (let route of apiRoute.routesDelete)
        router.delete(apiRoute.url + route.route, route.callback);
}

export function routes() {
    const router = express.Router();

    for (let apiRoute of apiRoutes) {
        makeRoutesForResource(router, apiRoute);
    }

    return router;
}



