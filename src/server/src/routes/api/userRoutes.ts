import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {usersController} from '../../controllers/users-controller'
import {platesController} from "../../controllers/plates-controller";
import {platterController} from "../../controllers/platter-controller";

class UserRoutes implements ApiRoutes {
    url = '/users';
    routesGet: ApiRoute[] = [
        {
            route: '/:userId/plates',
            callback: platesController.getAllForUser
        },
        {
            route: '/:userId/platters',
            callback: platterController.getAllForUser
        },
        {
            route: '/:userId/platters/:platterId/plates',
            callback: platterController.getAllForPlatter
        },
        {
            route: '/invitations',
            callback: usersController.getInvitations
        },
        {
            route: '/:userId/activities',
            callback: usersController.getActivitiesForUser
        },
        {
            route: '/:userId/emails',
            callback: usersController.getExtraEmails
        }
    ]
    routesPut: ApiRoute[] = [
        {
            route: '/:id',
            callback: usersController.update
        },
        {
            route: '/invitations/:id',
            callback: usersController.acceptInvitation
        },
        {
            route: '/:userId/plates/:plateId',
            callback: platesController.updatePlate
        },
        {
            route: '/:userId/plates/:plateId/doneheader',
            callback: platesController.updatePlateDoneHeaderStatus
        },
        {
            route: '/:userId/plates/:plateId/fullhidedoneheader',
            callback: platesController.fullyHideDoneHeaderToggle
        },
        {
            route: '/:userId/plates/:plateId/headers/:headerId/itemscanbedone',
            callback: platesController.toggleItemsCanBeMarkedAsDone
        },
        {
            route: '/:userId/plates/:plateId/headers/:headerId/name',
            callback: platesController.updateHeaderName
        },
        {
            route: '/:userId/activities/:activityId/acknowledge',
            callback: usersController.acknowledgeNotification
        }
    ];
    routesPost: ApiRoute[] = [
        {
            // Not really API, but that's ok
            route: '/feedback',
            callback: usersController.feedbackPost
        },
        {
            route: '/:userId/plates',
            callback: platesController.createPlate
        },
        {
            route: '/:userId/plates/assignplatters', // For the update to Platters
            callback: platesController.upgradeToPlattersIfNeeded
        },
        {
            route: '/:userId/platters',
            callback: platterController.createPlatter
        },
        {
            route: '/:userId/plates/:plateId/headers',
            callback: platesController.createHeader
        },
        {
            route: '/:userId/upgrade-to-business',
            callback: usersController.upgradeToPlateBusiness
        },
        {
            route: '/:userId/emails',
            callback: usersController.addExtraEmail
        },
        {
            route: '/:userId/emails/remove',
            callback: usersController.removeExtraEmail
        },
        {
            route: '/:userId/plate-business/cancel',
            callback: usersController.cancelPlateBusiness
        }
    ];
    routesDelete: ApiRoute[] = [
        {
            route: '/invitations/:id',
            callback: usersController.declineInvitation
        },
        {
            route: '/:userId/plates/:plateId/headers/:headerId',
            callback: platesController.deleteHeader
        }
    ];
}

export const userRoutes = new UserRoutes();
