import {IUser, IUserStatic, IUserTeamReference} from "../models/users";
import * as mongoose from "mongoose";
import {Resource} from "../resources/resource-service";
import {Config} from "../config/config-service";
import {ITeam, IInvitee, ITeamStatic, PERMISSION_KEYS} from "../models/teams";
import * as Q from "q";
import {INotificationStatic} from "../models/notifications";
import {usersController} from "./users-controller";
import {BaseController} from "./base-controller";
import {PlateUtil} from "../util/plate-util";
import {PlateMailer} from "../util/plate-mailer";
import {Activity, ServerActivityActionType} from "../models/activity";
import {socketController} from "../socket/socket-controller";
import {PaymentUtil} from "../util/payment-util";
const uuid = require('node-uuid');
const User:IUserStatic = <IUserStatic>mongoose.model('User');
const Team:ITeamStatic = <ITeamStatic>mongoose.model('Team');
const Notification:INotificationStatic = <INotificationStatic>mongoose.model('Notification');

// Utility for invite link
export interface InviteLinkDetails {
    inviterName:string;
    teamName:string;
    inviteeEmail:string;
    inviterId:string;
    teamId:string;
    inviteToken:string;
}

class TeamsController extends BaseController {

    get(req, res) {
        // TODO - Should extend from base controller
        const body = req.body;
        const userToken = req.userToken;
        if (!userToken) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_Unknown
            });
            Config.HandleServerSideError('No user token in get teams');
            return;
        } else {
            const id = userToken.id;
            if (!id) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('No email in get teams');
                return;
            } else {
                User.getById(id).then((user) => {
                    if (!user) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('No user exists in get teams');
                        return;
                    } else {
                        const teamIdToGet = req.params.id;
                        if (teamIdToGet) {
                            // Make sure user has access to team
                            Team.getByIdForUser(teamIdToGet, user).then((team) => {
                                team.getSimple().then((simpleTeam) => {
                                    res.send(simpleTeam);
                                }).catch((reason) => {
                                    res.status(400).json({
                                        message: Resource.Translatable.ERROR_Unknown
                                    });
                                })
                            }).catch((err) => {
                                res.status(401).json({
                                    message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                                });
                                Config.HandleServerSideError('user does not have access for team');
                            });
                        } else {
                            user.getTeams().then((teams) => {
                                let simpleTeams = [];
                                let numTeams = teams.length;
                                let teamsGotten = 0;
                                if (!teams || !teams.length) {
                                    res.send([]);
                                } else {
                                    for (let team of teams) {
                                        team.getSimple().then((simpleTeam) => {
                                            teamsGotten++;
                                            simpleTeams.push(simpleTeam);
                                            if (teamsGotten >= numTeams) {
                                                res.send(simpleTeams);
                                            }
                                        }).catch((reason) => {
                                            res.status(400).json({
                                                message: Resource.Translatable.ERROR_Unknown
                                            });
                                        })
                                    }
                                }
                            }).catch(Config.HandleServerSideError);
                        }
                    }
                }).catch(Config.HandleServerSideError);
            }
        }
    }

    getMembers(req, res) {
        const body = req.body;
        const userToken = req.userToken;
        if (!userToken) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_Unknown
            });
            Config.HandleServerSideError('No user token in get team members');
            return;
        } else {
            const id = userToken.id;
            if (!id) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('No email in team members');
                return;
            } else {
                User.getById(id).then((user) => {
                    if (!user) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('No user exists in get team members');
                        return;
                    } else {
                        const teamIdToGet = req.params.id;
                        if (teamIdToGet) {
                            // Make sure user has access to team
                            Team.getByIdForUser(teamIdToGet, user).then((team) => {
                                team.getMembers().then((members) => {
                                    res.send(members);
                                }).catch((error) => {
                                    res.status(400).json({
                                        message: Resource.Translatable.ERROR_Unknown
                                    });
                                    Config.HandleServerSideError('Error in getting team members');
                                });
                            }).catch((err) => {
                                res.status(401).json({
                                    message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                                });
                                Config.HandleServerSideError('user does not have access for team');
                            });
                        } else {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('No team id in get team members');
                        }
                    }
                }).catch(Config.HandleServerSideError);
            }
        }
    }

    /**
     * Updates a team
     * Returns OK
     */
    put(req, res) {
        const teamIdToGet = req.params.id;
        const newTeamBody = req.body;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            const badParameters = Team.VerifyParameters(newTeamBody);
            if (badParameters) {
                res.status(400).json({
                    message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                });
            } else {
                super.verifyUserLoggedIn(req, res, 'Team modify').then((user: IUser) => {
                    Team.getByIdForUser(teamIdToGet, user).then((team) => {
                        team.updateTeam(user, newTeamBody).then((savedTeam) => {
                            res.sendStatus(200);
                        }).catch((reason) => {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError(reason);
                        })
                    }).catch((err) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                        Config.HandleServerSideError('user does not have access for team');
                    });
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    /**
     * Updates a member in the team.
     * Sends OK
     */
    updateMember(req, res) {
        const teamIdToGet = req.params.id;
        const memberIdToUpdate = req.params.memberId;
        const newMemberBody: IUserTeamReference = req.body;
        if (!teamIdToGet || !memberIdToUpdate) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            const badParameters = Team.VerifyParametersForMember(newMemberBody);
            if (badParameters) {
                res.status(400).json({
                    message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                });
            } else {
                super.verifyUserLoggedIn(req, res, 'Team modify').then((user: IUser) => {
                    Team.getByIdForUser(teamIdToGet, user).then((team) => {
                        User.findById(memberIdToUpdate, (err, userToUpdate: IUser) => {
                            if (err) {
                                res.status(400).json({
                                    message: Resource.Translatable.ERROR_Unknown
                                });
                                Config.HandleServerSideError('error in finding user in team update member');
                            } else {
                                if (!user) {
                                    res.status(400).json({
                                        message: Resource.Translatable.ERROR_UserNotFound
                                    });
                                } else {
                                    userToUpdate.updateTeam(user, team, newMemberBody, true).then((result) => {
                                        res.sendStatus(200);
                                    })
                                        .catch((reason) => {
                                            res.status(400).json({
                                                message: reason
                                            });
                                        })
                                }
                            }
                        });
                    }).catch((err) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                        Config.HandleServerSideError('user does not have access for team');
                    });
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    /**
     * Gets invitations for the team
     */
    getInvitations(req, res) {
        const teamIdToGet = req.params.id;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'Team Controller Invitation action').then((user) => {
                Team.getByIdForUser(teamIdToGet, user).then((team) => {
                    if (!team) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                        });
                        return;
                    } else {
                        let simpleInvitations = [];
                        for (let invitation of team.invitees) {
                            simpleInvitations.push(Team.simpleInvitation(invitation));
                        }
                        res.send(simpleInvitations);
                    }
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                    })
                    Config.HandleServerSideError(reason);
                })
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    /**
     * Only for the purchaser
     * @param req
     * @param res
     */
    getPaymentDetailsForPlateBusiness(req, res) {
        const teamIdToGet = req.params.id;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'getPaymentDetailsForPlateBusiness').then((user) => {
                Team.getByIdForUser(teamIdToGet, user).then((team) => {
                    if (!team) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                        });
                        return;
                    } else {
                        let paymentDetails = team.getPaymentDetailsForPlateBusinessForPurchaser(user);
                        if (!paymentDetails) {
                            super.sendUnknownError(res);
                        } else {
                            res.send(paymentDetails);
                        }
                    }
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                    })
                    Config.HandleServerSideError(reason);
                })
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    updatePlateBusinessPermissions(req, res) {
        const teamIdToGet = req.params.id;
        const permissions = req.body.permissions;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'updatePlateBusinessPermissions').then((user) => {
                Team.getByIdForUser(teamIdToGet, user).then((team) => {
                    if (!team) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                        });
                        return;
                    } else {
                        team.updatePlateBusinessPermissions(user, permissions).then((team) => {
                        	res.sendStatus(200);
                        }).catch((reason) => {
                            res.status(401).json({
                                message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                            });
                        })
                    }
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                    })
                    Config.HandleServerSideError(reason);
                })
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    /**
     * Creates a team
     * @param req
     * @param res
     */
    post(req, res) {

        const body = req.body;
        const teamName = body.name;

        if (!teamName) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_TeamNameRequired
            });
            return;
        } else {
            const userToken = req.userToken;
            if (!userToken) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('No user token in save team');
                return;
            } else {
                const id = userToken.id;
                if (!id) {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('No email in save team');
                    return;
                } else {
                    User.getById(id).then((user) => {
                        if (!user) {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('No user exists in save team');
                            return;
                        } else {
                            Team.createTeamForUser(teamName, user).then((team) => {
                                team.getSimple().then((simpleTeam) => {
                                    res.send(simpleTeam);
                                }).catch((reason) => {
                                    res.status(400).json({
                                        message: Resource.Translatable.ERROR_Unknown
                                    });
                                })
                            }).catch((reason) => {
                                Config.HandleServerSideError('Error saving team');
                            })
                        }
                    }).catch(Config.HandleServerSideError);
                }
            }
        }

    }

    /**
     * Invites a user (or just an email) to a team
     * @param req
     * @param res Sends back the invitation
     */
    postInvitation(req, res) {

        const body = req.body;
        const teamIdToGet = req.params.id;
        const inviteeEmail = body.email;

        if (!inviteeEmail || !PlateUtil.emailIsValid(inviteeEmail)) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_InvalidEmail
            });
            return;
        } else {
            const userToken = req.userToken;
            if (!userToken) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('No user token in invite member');
                return;
            } else {
                const id = userToken.id;
                if (!id) {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('No user id in invite member');
                    return;
                } else {
                    User.getById(id).then((user) => {
                        if (!user) {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('No user exists in invite member');
                            return;
                        } else {
                            Team.getByIdForUser(teamIdToGet, user).then(
                                (team:ITeam) => {
                                    if (!team) {
                                        res.status(400).json({
                                            message: Resource.Translatable.ERROR_Unknown
                                        });
                                        Config.HandleServerSideError('No team exists in invite member');
                                        return;
                                    } else {
                                        let hasPermission = team.checkPermission(user, PERMISSION_KEYS.INVITE_MEMBERS, true);
                                        if (!hasPermission) {
                                            res.status(401).json({
                                                message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                                            });
                                        } else {
                                            if (team.invitees.length > 20) {
                                                res.status(400).json({
                                                    message: Resource.Translatable.ERROR_TooManyInvites
                                                });
                                                return;
                                            } else {
                                                let duplicate = false;
                                                for (let invitee of team.invitees) {
                                                    if (invitee.inviteeEmail === inviteeEmail) {
                                                        duplicate = true;
                                                        break;
                                                    }
                                                }
                                                if (duplicate) {
                                                    res.status(400).json({
                                                        message: Resource.Translatable.ERROR_UserAlreadyInvitedToTeam
                                                    });
                                                    return;
                                                } else {
                                                    // One week from now
                                                    const expiraton = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000);
                                                    const token = uuid.v4();
                                                    const invitee = {
                                                        inviteeEmail: inviteeEmail,
                                                        inviterId: user.id,
                                                        teamId: team.id,
                                                        token: token,
                                                        expiration: expiraton.getTime(),
                                                        inviterName: user.name,
                                                        inviterEmail: user.email
                                                    }
                                                    team.invitees.push(invitee);
                                                    team.save((err) => {
                                                        if (err) {
                                                            res.status(400).json({
                                                                message: Resource.Translatable.ERROR_Unknown
                                                            });
                                                            Config.HandleServerSideError('Error saving team in invite member');
                                                            return;
                                                        } else {
                                                            Activity.createActivity(null, null, user, team.id, team.id, ServerActivityActionType.InviteTeamMember, team.color, team.name, inviteeEmail);
                                                            PlateMailer.sendInviteForTeam({
                                                                email: inviteeEmail,
                                                                inviter: user,
                                                                team: team,
                                                                token: token
                                                            });
                                                            User.findByEmail(inviteeEmail).then((userToNotify) => {
                                                                if (userToNotify) {
                                                                    // Makes a notification for the user if they already exist
                                                                    Notification.NewNotificationInviteForTeam(user, userToNotify, team);
                                                                } else {
                                                                    // Otherwise, save a notification for when they first log in
                                                                    Notification.newNotificationInviteForTeamUserDoesNotExist(user, inviteeEmail, team);
                                                                }
                                                            }).catch(Config.HandleServerSideError);

                                                            // We need to re-retrieve the invite with its new ID
                                                            for (let teamInvitee of team.invitees) {
                                                                if (teamInvitee.inviteeEmail === invitee.inviteeEmail) {
                                                                    res.send(Team.simpleInvitation(teamInvitee));
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    })
                                                }
                                            }
                                        }
                                    }
                                }
                            ).catch(Config.HandleServerSideError);
                        }
                    }).catch(Config.HandleServerSideError);
                }
            }
        }

    }

    deleteInvitation(req, res) {
        const teamIdToGet = req.params.id;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            const inviteeIdToDelete = req.params.inviteId;
            if (!inviteeIdToDelete) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_MissingId
                });
                return;
            } else {
                super.verifyUserLoggedIn(req, res, 'Team Controller Delete Invitation').then((user) => {
                    Team.getByIdForUser(teamIdToGet, user).then((team) => {
                        if (!team) {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                            });
                            return;
                        } else {
                            let foundInvitation = null;
                            for (let invitation of team.invitees) {
                                if (invitation.id === inviteeIdToDelete) {
                                    foundInvitation = invitation;
                                }
                            }
                            if (!foundInvitation) {
                                res.status(401).json({
                                    message: Resource.Translatable.ERROR_NoInviteFound
                                });
                                return;
                            } else {
                                team.removeInvitee(foundInvitation);
                                res.sendStatus(200);
                            }
                        }
                    }).catch((reason) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                        })
                        Config.HandleServerSideError(reason);
                    })
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    /**
     * Delete a member given a team and an ID.
     * Sends OK.
     * @param req
     * @param res
     */
    deleteMember(req, res) {
        const teamIdToGet: string = req.params.id;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            const memberIdToDelete: string = req.params.memberId;
            if (!memberIdToDelete) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_MissingId
                });
                return;
            } else {
                super.verifyUserLoggedIn(req, res, 'Team Controller Delete Member').then((user) => {
                    Team.getByIdForUser(teamIdToGet, user).then((team) => {
                        if (!team) {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                            });
                            return;
                        } else {
                            let hasPermission = team.checkPermission(user, PERMISSION_KEYS.INVITE_MEMBERS, true);
                            if (!hasPermission) {
                                res.status(401).json({
                                    message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                                })
                            } else {
                                User.removeFromTeam(memberIdToDelete, team, user).then((deletedUser) => {
                                    res.sendStatus(200);
                                }).catch((reason) => {
                                    res.status(400).json({
                                        message: reason
                                    })
                                    Config.HandleServerSideError(reason);
                                });
                            }
                        }
                    }).catch((reason) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccessForTeam
                        })
                        Config.HandleServerSideError(reason);
                    })
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    /**
     * Verifies validity of token and returns InviteLinkDetails
     * @param teamId
     * @param inviterId
     * @param token
     * @returns {Promise<T>}
     */
    getInviteTokenFromUrlParams(teamId:string, inviterId:string, token:string, removeTokenIfSuccessful?:boolean):Q.Promise<[ITeam, InviteLinkDetails]> {
        // /login/:teamId/:inviterId/:token
        let deferred = Q.defer<[ITeam, InviteLinkDetails]>();
        if (!teamId || !inviterId || !token) {
            deferred.reject('Missing params');
        } else {
            User.findById(inviterId, (err, inviter) => {
                if (err) {
                    deferred.reject('Couldn\'t find user');
                } else {
                    if (!inviter) {
                        deferred.reject('Couldn\'t find user');
                    } else {
                        Team.getByIdForUser(teamId, inviter).then((team) => {
                            if (!team) {
                                deferred.reject('Couldn\'t find team');
                            } else {
                                let foundInvitee:IInvitee = null;
                                for (let invitee of team.invitees) {
                                    if (invitee.token === token) {
                                        foundInvitee = invitee;
                                        break;
                                    }
                                }
                                if (!foundInvitee) {
                                    deferred.reject('Couldn\'t find invitee on team');
                                } else {
                                    if (Team.isInviteeTokenExpired(foundInvitee)) {
                                        team.removeInvitee(foundInvitee);
                                        deferred.reject('Token expired');
                                    } else {
                                        const details:InviteLinkDetails = {
                                            inviterName: inviter.email,
                                            teamName: team.name,
                                            inviteeEmail: foundInvitee.inviteeEmail,
                                            inviterId: inviterId,
                                            teamId: teamId,
                                            inviteToken: token
                                        }
                                        if (removeTokenIfSuccessful) {
                                            team.removeInvitee(foundInvitee);
                                        }
                                        deferred.resolve([team, details]);
                                    }
                                }
                            }
                        }).catch(error => deferred.reject(error));
                    }
                }
            });
        }
        return deferred.promise;
    }

}

export const teamController = new TeamsController();






