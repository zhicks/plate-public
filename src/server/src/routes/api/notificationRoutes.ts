import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {notificationsController} from '../../controllers/notifications-controller';

class NotificationRoutes implements ApiRoutes {
    url = '/notifications';

    routesGet: ApiRoute[] = [
        {
            route: '/',
            callback: notificationsController.get
        },
        {
            route: '/:id',
            callback: notificationsController.get
        }
    ]

    routesPut: ApiRoute[] = [
        {
            route: '/:id/seen',
            callback: notificationsController.markSeen
        },
        {
            route: '/:id/acknowledge',
            callback: notificationsController.acknowledge
        }
    ]

    routesPost: ApiRoute[] = [

    ]

    routesDelete: ApiRoute[] = [

    ]
}

export const notificationRoutes = new NotificationRoutes();
