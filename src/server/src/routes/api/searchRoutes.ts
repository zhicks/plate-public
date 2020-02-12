import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {searchController} from '../../controllers/search-controller'

class SearchRoutes implements ApiRoutes {
    url = '/search';

    routesGet: ApiRoute[] = [
        {
            route: '/',
            callback: searchController.search
        }
    ]

    routesPut: ApiRoute[] = [
    ];

    routesPost: ApiRoute[] = [
    ];

    routesDelete: ApiRoute[] = [
    ];
}

export const searchRoutes = new SearchRoutes();

