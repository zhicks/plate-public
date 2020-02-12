import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {usersController} from '../../controllers/users-controller'
import {connectedAppsController} from "../../controllers/connectedapps-controller";

class ConnectedAppRoutes implements ApiRoutes {
    url = '/users/:userId/connectedapps';
    routesGet: ApiRoute[] = [
        {
            route: '/',
            callback: connectedAppsController.getAllForUser
        },
        {
            route: '/:connectedAppId/items',
            callback: connectedAppsController.getItemsForConnectedApp
        },
        {
            route: '/:connectedAppId/search',
            callback: connectedAppsController.searchConnectedApp
        },
        {
            route: '/:connectedAppId/slackauth',
            callback: connectedAppsController.slackAuth
        },
        {
            route: '/:connectedAppId/gmailauth',
            callback: connectedAppsController.gmailAuth
        }
    ]
    routesPut: ApiRoute[] = [
        {
            route: '/:connectedAppId',
            callback: connectedAppsController.updateConnectedApp
        }
    ];
    routesPost: ApiRoute[] = [
        {
            route: '/',
            callback: connectedAppsController.newConnectedApp
        },
        {
            route: '/:connectedAppId/items',
            callback: connectedAppsController.newConnectedAppItem
        },
        {
            route: '/:connectedAppId/automation-rules',
            callback: connectedAppsController.createAutomationRule
        }
    ];
    routesDelete: ApiRoute[] = [
        {
            route: '/:connectedAppId/automation-rules/:automationRuleId',
            callback: connectedAppsController.deleteAutomationRule
        }
    ];
}

export const connectedAppRoutes = new ConnectedAppRoutes();
