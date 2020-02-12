import {IUser} from "../models/users";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import {Resource} from "../resources/resource-service";
import {Platter, ISimplePlatter} from "../models/platters";
import {Team} from "../models/teams";
import {socketController} from "../socket/socket-controller";
import {Plate} from "../models/plates";

class PlatterController extends BaseController {

    getAllForUser(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platters get for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            Platter.getAllForUser(user).then((platters) => {
                let simplePlatters = [];
                for (let platter of platters) {
                    simplePlatters.push(platter.simple());
                }
                res.send(simplePlatters);
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in get all platters for user');
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    getAllForPlatter(req, res) {
        super.verifyUserLoggedIn(req, res, 'Get plates for platter').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            const platterId = req.params.platterId;
            Platter.getByIdForUser(platterId, user).then((platter) => {
                if (!platter) {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                } else {
                    Plate.getAllForPlatter(platter).then((plates) => {
                        let simplePlates = [];
                        for (let plate of plates) {
                            simplePlates.push(plate.simple());
                        }
                        res.send(simplePlates);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updatePlatter(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platter update').then((user: IUser) => {
            const newPlatterInfo: ISimplePlatter = req.body;
            const platterToGet = req.params.platterId;
            const badParameters = Platter.VerifyParameters(newPlatterInfo);
            if (badParameters) {
                res.status(400).json({
                    message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                });
                return;
            }
            Platter.getByIdForUser(platterToGet, user).then((platter) => {
                platter.updatePlatter(user, newPlatterInfo).then((platter) => {
                    res.sendStatus(200);
                    socketController.serverEventTeamPlatterEdited(user, platter);
                }).catch((reason) => {
                    res.status(400).send({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }).catch((reason) => {
                res.status(401).send({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updatePlatePositions(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platter update').then((user: IUser) => {
            const platterToGet = req.params.platterId;
            const positions = req.body.positions;
            Platter.getByIdForUser(platterToGet, user).then((platter) => {
            	Plate.updatePositionsForPlatter(user, platter, positions).then((plate) => {
                    res.sendStatus(200);
            	}).catch((reason) => {
            	    super.sendUnknownError(res);
            	})
            }).catch((reason) => {
                res.status(401).send({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    setExpanded(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platters set expanded').then((user: IUser) => {
            const plateToGet = req.params.platterId;
            const expanded = req.body.expanded;
            Platter.getByIdForUser(plateToGet, user).then((platter) => {
                platter.setExpanded(expanded).then((platter) => {
                	res.sendStatus(200);
                }).catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('in set expanded for platter');
                })
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in set expanded for platter');
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    createPlatter(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platter create').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const newPlatterInfo: ISimplePlatter = req.body;
                const badParameters = Platter.VerifyParameters(newPlatterInfo);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                    return;
                }
                const teamId = newPlatterInfo.team;
                if (teamId) {
                    Team.getByIdForUser(teamId, user).then((team) => {
                    	if (!team) {
                            res.status(400).send({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                        } else {
                            Platter.newPlatter(user, newPlatterInfo, null, team).then((platter) => {
                                res.send(platter.simple());
                                socketController.serverEventTeamPlatterAdded(user, platter);
                            }).catch((reason) => {
                                res.status(400).send({
                                    message: Resource.Translatable.ERROR_Unknown
                                });
                            });
                        }
                    }).catch((reason) => {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                } else {
                    Platter.newPlatter(user, newPlatterInfo).then((platter) => {
                        res.send(platter.simple());
                    }).catch((reason) => {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    });
                }
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    archive(req, res) {
        super.verifyUserLoggedIn(req, res, 'Platter archive').then((user: IUser) => {
            const platterToGet = req.params.platterId;
            Platter.getByIdForUser(platterToGet, user).then((platter) => {
                platter.archive(user).then((platter) => {
                    res.sendStatus(200);
                    socketController.serverEventTeamPlatterEdited(user, platter);
                }).catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('in archive for platter');
                })
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in archive for platter');
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

}

export const platterController = new PlatterController();