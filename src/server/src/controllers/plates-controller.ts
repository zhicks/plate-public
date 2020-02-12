import {IUser} from "../models/users";
import {INotificationStatic} from "../models/notifications";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import * as mongoose from "mongoose";
import {Resource} from "../resources/resource-service";
import {Plate, ISimplePlate} from "../models/plates";
import {PlateItem, ISimplePlateItem} from "../models/plate-item";
import {Platter} from "../models/platters";
import {socketController} from "../socket/socket-controller";
const Notification: INotificationStatic = <INotificationStatic>mongoose.model('Notification');

class PlatesController extends BaseController {

    /**
     * From the User Controller. Url: /users/:userId/plates
     * @param req
     * @param res
     */
    getAllForUser(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plates get for user').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
                return;
            }
            Plate.getAllForUser(user).then((plates) => {
                let simplePlates = [];
                for (let plate of plates) {
                    simplePlates.push(plate.simple());
                }
                res.send(simplePlates);
            }).catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in get all plates for user');
            });
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    // getById(req, res) {
    //     res.send('Not implemented');
    // }

    getItems(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate items get').then((user: IUser) => {
            const plateToGet = req.params.id;
            if (plateToGet) {
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    PlateItem.getItemsForPlate(plate).then((plateItems) => {
                        if (!plateItems || !plateItems.length) {
                            res.send([]);
                        } else {
                            let simplePlateItems = [];
                            for (let plateItem of plateItems) {
                                simplePlateItems.push(plateItem.simple());
                            }
                            res.send(simplePlateItems);
                        }
                    }).catch((reason) => {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('in get items for plate');
                    });
                }).catch((reason) => {
                    res.status(401).send({
                        message: Resource.Translatable.ERROR_DoesntExistOrUnauthorized
                    });
                })
            } else {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_MissingId
                });
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    movePlateToPlatter(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate item save').then((user: IUser) => {
            const plateToGet = req.params.id;
            if (plateToGet) {
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    let moveDetails = req.body.move;
                    if (!moveDetails) {
                        super.sendUnknownError(res);
                    } else {
                        plate.movePlateToPlatter(user, platter, moveDetails.newPlatterId, moveDetails.oldPlatterPositions, moveDetails.newPlatterPositions).then((plate) => {
                        	res.sendStatus(200);
                        }).catch((reason) => {
                            super.sendUnknownError(res);
                        })
                    }
                }).catch((reason) => {
                    super.sendUnknownError(res);
                });
            } else {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_MissingId
                });
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    createItem(req, res) {
        const newPlateInfo: ISimplePlateItem = req.body;
        if (!newPlateInfo.title || !newPlateInfo.plate || !newPlateInfo.header) {
            res.status(400).send({
                message: Resource.Translatable.ERROR_MissingParameters
            });
            return;
        }
        const badParameters = PlateItem.VerifyParameters(newPlateInfo);
        if (badParameters) {
            res.status(400).json({
                message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
            });
            return;
        }
        super.verifyUserLoggedIn(req, res, 'Plate item save').then((user: IUser) => {
            const plateToGet = req.params.id;
            if (plateToGet) {
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    PlateItem.createPlateItemForUser(plate, platter, newPlateInfo, user).then(([plateItem, plate]) => {
                        res.send(plateItem.simple());
                        socketController.serverEventTeamPlateItemAdded(user, plateItem, platter);
                    }).catch((reason) => {
                        res.status(400).send({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }).catch((reason) => {
                    res.status(400).send({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                });
            } else {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_MissingId
                });
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    createPlate(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate items get').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const newPlateInfo: ISimplePlate = req.body;
                const badParameters = Plate.VerifyParameters(newPlateInfo);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                    return;
                }
                if (!newPlateInfo.platter) {
                    res.status(400).send({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                } else {
                    Platter.getByIdForUser(newPlateInfo.platter, user).then((platter) => {
                        Plate.createPlate(user, newPlateInfo, platter).then((plate) => {
                            if (platter.team) {
                                socketController.serverEventTeamPlateAdded(user, platter, plate);
                            }
                            res.send(plate.simple());
                        }).catch((reason) => {

                        });
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

    /**
     *
     * @param req
     * @param res
     */
    upgradeToPlattersIfNeeded(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate assign platters').then((user: IUser) => {
            if (user.upgradedToPlatters) {
                res.sendStatus(200);
            } else {
                if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                } else {
                    Plate.upgradeToPlattersForUserIfNeeded(user).then((booleanStatus) => {
                        res.sendStatus(200);
                    }).catch((reason) => {
                        res.status(401).send({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                    });
                }
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updatePlate(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate items get').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const newPlateInfo = req.body;
                const plateToGet = req.params.plateId;
                const badParameters = Plate.VerifyParameters(newPlateInfo);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                    return;
                }
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.updatePlate(user, platter, newPlateInfo).then((plate) => {
                    	res.sendStatus(200);
                        socketController.serverEventTeamPlateEdited(user, platter, plate);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updatePlateDoneHeaderStatus(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update done header').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const hidden = req.body.isHidden;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.toggleDoneHeaderHide(user, hidden).then((plate) => {
                        res.sendStatus(200);
                        socketController.serverEventTeamPlateEdited(user, platter, plate);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    fullyHideDoneHeaderToggle(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update done header full hide').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const hidden = req.body.isFullyHidden;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.toggleDoneHeaderFullyHide(user, hidden).then((plate) => {
                        res.sendStatus(200);
                        socketController.serverEventTeamPlateEdited(user, platter, plate);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    toggleItemsCanBeMarkedAsDone(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update header mark as done toggle').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const headerId = req.params.headerId;
                const itemsCanBeDone = req.body.itemsCanBeDone;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.toggleItemsCanBeMarkedAsDone(user, headerId, itemsCanBeDone).then((plate) => {
                        res.sendStatus(200);
                        socketController.serverEventTeamPlateEdited(user, platter, plate);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updateHeaderName(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update header mark as done toggle').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const headerId = req.params.headerId;
                const name = req.body.name;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.updateHeaderName(user, headerId, name, platter).then((plate) => {
                        res.sendStatus(200);
                        socketController.serverEventTeamPlateEdited(user, platter, plate);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    createHeader(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update header mark as done toggle').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const name = req.body.name;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.newHeader(user, name, platter).then((simpleHeader) => {
                        res.send(simpleHeader);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    deleteHeader(req, res) {
        super.verifyUserLoggedIn(req, res, 'Plate update header mark as done toggle').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                const plateToGet = req.params.plateId;
                const headerId = req.params.headerId;
                Plate.getByIdForUser(user, plateToGet).then(([plate, platter]) => {
                    plate.deleteHeader(user, headerId, platter).then((plate) => {
                        res.sendStatus(200);
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
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

}

export const platesController = new PlatesController();