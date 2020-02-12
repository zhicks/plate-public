import {IUser, ISimpleUser} from "../models/users";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import {ITeamStatic, PERMISSION_KEYS} from "../models/teams";
import * as mongoose from "mongoose";
import {Resource} from "../resources/resource-service";
import {PlateMailer} from "../util/plate-mailer";
import {Activity} from "../models/activity";
import {ServerPaymentInterval, PaymentUtil} from "../util/payment-util";
const Team:ITeamStatic = <ITeamStatic>mongoose.model('Team');


export interface LoggedInUserFeedback {
    message?: string;
    rating?: number;
}

class UsersController extends BaseController {

    // Not really API, but that's ok
    feedbackPost(req, res) {
        super.verifyUserLoggedIn(req, res, 'User feedback').then((user: IUser) => {
            let feedback: LoggedInUserFeedback = req.body;
            if (!(feedback.message || feedback.rating)) {
                // Simply acknowledging the feedback menu records feedback
                // So we don't pester them
                user.recordFeedbackSent(feedback.message, feedback.rating).then((user) => {
                    res.sendStatus(200);
                }).catch((reason) => {
                    res.sendStatus(400);
                });
            } else {
                PlateMailer.userFeedback(user.email, feedback).then((status) => {
                    user.recordFeedbackSent(feedback.message, feedback.rating).then((user) => {
                        res.sendStatus(status);
                    }).catch((reason) => {
                        res.sendStatus(400);
                    })
                }).catch((reason) => {
                    res.sendStatus(400);
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    update(req, res) {
        super.verifyUserLoggedIn(req, res, 'Update user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.id)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            let newDetails: ISimpleUser = req.body;
            user.updateUser(newDetails).then((plates) => {
                res.sendStatus(200);
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in update user');
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    /**
     * Gets team invitations for the logged in user
     */
    getInvitations(req, res) {
        super.verifyUserLoggedIn(req, res, 'Team Controller Get Invitations').then((user) => {
            Team.getInvitationsForUser(user).then((invitations) => {
                res.send(invitations);
            }).catch(reason => Config.HandleServerSideError(reason))
        }).catch(reason => Config.HandleServerSideError(reason))
    }

    getActivitiesForUser(req, res) {
        super.verifyUserLoggedIn(req, res, 'Get activites for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            Activity.getForUser(user).then((activities) => {
                res.send(Activity.simpleArray(activities));
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in get activites for user');
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    getExtraEmails(req, res) {
        super.verifyUserLoggedIn(req, res, 'Get activites for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            res.send(user.extraEmails);
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    addExtraEmail(req, res) {
        let email = req.body.email;
        if (!email) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingEmail
            });
            return;
        }
        super.verifyUserLoggedIn(req, res, 'Get activites for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            user.addExtraEmail(email).then((user) => {
            	res.sendStatus(200);
            }).catch((reason) => {
                res.status(400).json({
                    message: reason
                });
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    removeExtraEmail(req, res) {
        let email = req.body.email;
        if (!email) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingEmail
            });
            return;
        }
        super.verifyUserLoggedIn(req, res, 'Get activites for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            user.removeExtraEmail(email).then((user) => {
                res.sendStatus(200);
            }).catch((reason) => {
                res.status(400).json({
                    message: reason
                });
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    upgradeToPlateBusiness(req, res) {
        super.verifyUserLoggedIn(req, res, 'upgradeToPlateBusiness').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const upgradeInfo: {
                    paymentInterval: ServerPaymentInterval,
                    expectedPriceInCents: number,
                    team: string,
                    stripeToken: any,
                    promoCode: string
                } = req.body;
                if (!upgradeInfo ||
                    !upgradeInfo.expectedPriceInCents ||
                    !upgradeInfo.team ||
                    !upgradeInfo.stripeToken ||
                    (upgradeInfo.paymentInterval !== ServerPaymentInterval.Monthly &&
                    upgradeInfo.paymentInterval  !== ServerPaymentInterval.Yearly)) {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_MissingParameters
                    });
                } else {
                    const teamId = upgradeInfo.team;
                    Team.getByIdForUser(teamId, user).then((team) => {
                        if (!team) {
                            res.status(400).send({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                        } else {
                            if (Team.getIsPlateBusiness(team)) {
                                res.status(400).send({
                                    message: 'This team is already Plate for Business'
                                });
                            } else {
                                // The permission here actually doesn't matter
                                let hasPermission = team.checkPermission(user, PERMISSION_KEYS.MODIFY_TEAM_NAME_COLOR, false);
                                if (!hasPermission) {
                                    res.status(401).send({
                                        message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                                    });
                                } else {
                                    let promoCode = upgradeInfo.promoCode;
                                    PaymentUtil.subscribeTeamForPlateBusiness(user, upgradeInfo.paymentInterval, team, upgradeInfo.stripeToken, promoCode).then((stripeDetails) => {
                                        team.upgradeToPlateBusiness(user, upgradeInfo.paymentInterval, upgradeInfo.team, stripeDetails).then((team) => {
                                            res.sendStatus(200);
                                            PlateMailer.sendReport('A Team has signed up for Plate Business', team.name + ' signed up for Plate Business');
                                        }).catch((reason) => {
                                            res.status(400).send({
                                                message: reason
                                            });
                                        })
                                    }).catch((reason) => {
                                        res.status(400).send({
                                            message: 'Unknown error'
                                        });
                                    })
                                }
                            }
                        }
                    }).catch((reason) => {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }

            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    cancelPlateBusiness(req, res) {
        super.verifyUserLoggedIn(req, res, 'cancelPlateBusiness').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const teamId = req.body.team;
                Team.getByIdForUser(teamId, user).then((team) => {
                    if (!team) {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    } else {
                        if (!Team.getIsPlateBusiness(team)) {
                            res.status(400).send({
                                message: 'This team is not Plate Business'
                            });
                        } else {
                            if (!team.userIsPurchaserOfPlateBusiness(user)) {
                                res.status(400).send({
                                    message: 'Only the paying user can cancel the subscription'
                                });
                            } else {
                                // This is also present in the team model if the purchaser was removed
                                PaymentUtil.cancelPlateBusiness(team).then((status) => {
                                    team.cancelPlateBusiness(user).then((team) => {
                                        res.sendStatus(200);
                                    }).catch((reason) => {
                                        res.status(400).send({
                                            message: reason
                                        });
                                    })
                                }).catch((reason) => {
                                    res.status(400).send({
                                        message: 'Unknown error'
                                    });
                                })
                            }
                        }
                    }
                }).catch((reason) => {
                    res.status(400).send({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })

            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    /**
     * Given an id for a team, accepts the invitation and deletes it from the team.
     * @param req
     * @param res
     */
    acceptInvitation = (req, res) => {
        this.invitationAction(req, res, true);
    }

    /**
     * Given an id for a team, declines the invitation if the user was invited.
     * @param req
     * @param res
     */
    declineInvitation = (req, res) => {
        this.invitationAction(req, res, false);
    }


    /**
     * Take an action on a specific invitation - either accept or decline.
     * Either way deletes the invitation.
     * @param req
     * @param res
     */
    private invitationAction(req, res, accept: boolean) {
        const teamIdToGet = req.params.id;
        if (!teamIdToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'User Controller Invitation action').then((user) => {
                Team.getByIdForInvitationPurposes(teamIdToGet).then((team) => {
                    if (!team) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_DoesntExist
                        });
                        return;
                    } else {
                        let foundInvitation = null;
                        for (let invitation of team.invitees) {
                            if (invitation.inviteeEmail === user.email) {
                                foundInvitation = invitation;
                            }
                        }
                        if (!foundInvitation) {
                            res.status(401).json({
                                message: Resource.Translatable.ERROR_NoInviteFound
                            });
                            return;
                        } else {
                            if (accept) {
                                user.addTeam(team, {
                                    id: team.id,
                                    role: 'user'
                                }).then((user) => {
                                    if (!user) {
                                        res.status(401).json({
                                            message: Resource.Translatable.ERROR_Unknown
                                        });
                                        Config.HandleServerSideError('in adding user in team');
                                    } else {
                                        team.removeInvitee(foundInvitation);
                                        team.getSimple().then((simpleTeam) => {
                                        	res.send(simpleTeam);
                                        }).catch((reason) => {
                                            res.status(400).json({
                                                message: Resource.Translatable.ERROR_Unknown
                                            });
                                        })
                                    }
                                }).catch(Config.HandleServerSideError)
                            } else {
                                team.removeInvitee(foundInvitation);
                                res.sendStatus(200);
                            }
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

    acknowledgeNotification(req, res) {
        super.verifyUserLoggedIn(req, res, 'Acknowledge notification').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            const activityId = req.params.activityId;
            Activity.acknowledge(activityId, user).then((something) => {
            	res.sendStatus(200);
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }
}

export const usersController = new UsersController();