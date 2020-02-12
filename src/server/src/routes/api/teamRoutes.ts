import {ApiRoute, ApiRoutes} from "../apiRoutes";
import { teamController }  from '../../controllers/teams-controller';

class TeamRoutes implements ApiRoutes {
    url = '/team';
    routesGet: ApiRoute[] = [
        {
            route: '/',
            callback: teamController.get
        },
        {
            route: '/:id',
            callback: teamController.get
        },
        {
            route: '/:id/members',
            callback: teamController.getMembers
        },
        {
            route: '/:id/invitations',
            callback: teamController.getInvitations
        },
        {
            route: '/:id/plate-business/payment',
            callback: teamController.getPaymentDetailsForPlateBusiness
        }
    ]
    routesPut: ApiRoute[] = [
        {
            route: '/:id',
            callback: teamController.put
        },
        {
            route: '/:id/members/:memberId',
            callback: teamController.updateMember
        },
    ];
    routesPost: ApiRoute[] = [
        {
            route: '/',
            callback: teamController.post
        },
        {
            route: '/:id/invitations/',
            callback: teamController.postInvitation
        },
        {
            route: '/:id/plate-business/permissions',
            callback: teamController.updatePlateBusinessPermissions
        }
    ]
    routesDelete: ApiRoute[] = [
        {
            route: '/:id/invitations/:inviteId',
            callback: teamController.deleteInvitation
        },
        {
            route: '/:id/members/:memberId',
            callback: teamController.deleteMember
        }
    ];
}

export const teamRoutes = new TeamRoutes();

