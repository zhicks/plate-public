import {ApiRoute, ApiRoutes} from "../apiRoutes";
import {plateItemsController} from '../../controllers/plateitems-controller'

class PlateItemRoutes implements ApiRoutes {
    url = '/plateitems';

    routesGet: ApiRoute[] = [
        {
            route: '/:id',
            callback: plateItemsController.getItemById
        },
        {
            route: '/:id/comments',
            callback: plateItemsController.getComments
        },
        {
            route: '/:id/activities',
            callback: plateItemsController.getActivities
        },
        {
            route: '/:id/team',
            callback: plateItemsController.getTeam
        },
        {
            route: '/:id/fileattachments/:attachmentId',
            callback: plateItemsController.getFileAttachment
        }
    ]

    routesPut: ApiRoute[] = [
        {
            route: '/:id',
            callback: plateItemsController.updateItem
        },
        {
            route: '/:id/pos',
            callback: plateItemsController.updateItemPosition
        },
        {
            route: '/:id/comments/:commentId',
            callback: plateItemsController.updateComment
        },
        {
            route: '/:id/metrics',
            callback: plateItemsController.updateMetrics
        },
        {
            route: '/:id/duedate',
            callback: plateItemsController.updateDueDate
        }
    ];

    routesPost: ApiRoute[] = [
        {
            route: '/:id/comments',
            callback: plateItemsController.createComment
        },
        {
            route: '/:id/assignees',
            callback: plateItemsController.addAssignee
        },
        {
            route: '/:id/fileattachments',
            callback: plateItemsController.addFileAttachment
        }
    ];

    routesDelete: ApiRoute[] = [
        {
            route: '/:id/attachments/:attachmentId',
            callback: plateItemsController.deleteConnectedAppAttachment
        },
        {
            route: '/:id/assignees/:assigneeId',
            callback: plateItemsController.removeAssignee
        },
        {
            route: '/:id/fileattachments/:attachmentId',
            callback: plateItemsController.deleteFileAttachment
        }
    ];
}

export const plateItemRoutes = new PlateItemRoutes();

