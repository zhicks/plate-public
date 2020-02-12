import {IUser} from "../models/users";
import {INotification, INotificationStatic} from "../models/notifications";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import * as mongoose from "mongoose";
import {Resource} from "../resources/resource-service";
import {PlateItem, ISimplePlateItem, ISimpleMetric, IPlateItem} from "../models/plate-item";
import {socketController} from "../socket/socket-controller";
import {PlateItemComment, ISimplePlateItemComment} from "../models/plate-item-comment";
import {Activity, ServerActivityActionType} from "../models/activity";
import {Team} from "../models/teams";
import {plateFileHandler} from "../util/plate-file-handler";
const Notification: INotificationStatic = <INotificationStatic>mongoose.model('Notification');

class PlateItemsController extends BaseController {

    getItemById(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item get').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    res.send(plateItem.simple());
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    getComments(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item get comments').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    PlateItemComment.getCommentsForPlateItem(plateItem, user).then((comments) => {
                    	let simpleComments = [];
                        for (let comment of comments) {
                            simpleComments.push(comment.simple());
                        }
                        res.send(simpleComments);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('unknown error in plate items get comments');
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    getActivities(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item get activities').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    Activity.getForItemId(user, plateItem.id).then((activities) => {
                    	let simpleActivities = Activity.simpleArray(activities);
                        res.send(simpleActivities);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('unknown error in plate items get activities');
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    getTeam(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item get team').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    if (!platter.team) {
                        res.send(null);
                    } else {
                        Team.getByIdForUser(platter.team.toString(), user).then((team) => {
                            if (!team) {
                                res.send(null);
                            } else {
                                team.getSimple().then((simpleTeam) => {
                                    res.send(simpleTeam);
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
                        })
                    }
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    createComment(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            let commentDetails: ISimplePlateItemComment = req.body;
            if (!commentDetails || !commentDetails.content) {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_MissingParameters
                });
                return;
            }
            let badParameters = PlateItemComment.VerifyParameters(commentDetails);
            if (badParameters) {
                res.status(400).json({
                    message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                });
                return;
            }
            super.verifyUserLoggedIn(req, res, 'plate item save comment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    PlateItemComment.newCommentForPlateItem(plateItem, user, commentDetails).then((comment) => {
                        res.send(comment.simple());
                        socketController.serverEventTeamPlateItemEdited(user, plateItem, platter);
                        Activity.createActivity(plate.id, platter, user, plateItem.id, platter.team, ServerActivityActionType.CreateComment, plate.color, plateItem.title, plate.name, comment.content);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('unknown error in plate item save comment');
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    updateComment(req, res) {
        const itemToGet = req.params.id;
        const commentToGet = req.params.commentId;
        if (!itemToGet || !commentToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            let commentDetails: ISimplePlateItemComment = req.body;
            if (!commentDetails) {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_MissingParameters
                });
                return;
            }
            let badParameters = PlateItemComment.VerifyParameters(commentDetails);
            if (badParameters) {
                res.status(400).json({
                    message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                });
                return;
            }
            super.verifyUserLoggedIn(req, res, 'plate item update comment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    PlateItemComment.findByIdForPlateItem(commentToGet, plateItem, user).then((comment) => {
                    	comment.updateComment(commentDetails, user, plateItem).then((savedComment) => {
                    		res.sendStatus(200);
                            socketController.serverEventTeamPlateItemEdited(user, plateItem, platter);
                            Activity.createActivity(plate.id, platter, user, plateItem.id, platter.team, ServerActivityActionType.EditComment, plate.color, plateItem.title, plate.name, comment.content);
                    	}).catch((reason) => {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('unknown error in save plate item comment');
                    	})
                    }).catch((reason) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    addAssignee(req, res) {
        const itemToGet = req.params.id;
        const assignee = req.body.assignee;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item add assignee').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    plateItem.addAssignee(assignee, user, platter, plate).then((plateItem) => {
                    	res.send(plateItem.simple());
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }
    removeAssignee(req, res) {
        const itemToGet = req.params.id;
        const assignee = req.params.assigneeId;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item add assignee').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    plateItem.removeAssignee(assignee, user, platter, plate).then((plateItem) => {
                        res.send(plateItem.simple());
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    updateDueDate(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            let due = req.body.due;
            super.verifyUserLoggedIn(req, res, 'plate item update comment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    plateItem.changeDueDate(user, platter, plate, due).then((plateItem) => {
                    	res.sendStatus(200);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    deleteConnectedAppAttachment(req, res) {
        const itemToGet = req.params.id;
        const attachmentToGet = req.params.attachmentId;
        if (!itemToGet || !attachmentToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item update comment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    plateItem.deleteConnectedAppAttachment(attachmentToGet).then((plateItem) => {
                    	res.sendStatus(200);
                        socketController.serverEventTeamPlateItemEdited(user, plateItem, platter)
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('in delete attachment for plate item');
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    deleteFileAttachment(req, res) {
        const itemToGet = req.params.id;
        const attachmentToGet = req.params.attachmentId;
        if (!itemToGet || !attachmentToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item delete file attachment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    plateItem.deleteFileAttachment(attachmentToGet).then((fileAttachment) => {
                        res.sendStatus(200);
                        socketController.serverEventTeamPlateItemEdited(user, plateItem, platter);
                        Activity.createActivity(plate.id, platter, user, plateItem.id, platter.team, ServerActivityActionType.RemoveFileAttachment, plate.color, plateItem.title, plate.name, fileAttachment.fileName);
                        if (fileAttachment) {
                            plateFileHandler.deleteFileAttachment(fileAttachment).then((status) => {
                            	// Do nothing
                            }).catch((reason) => {
                                console.error('error in deleting file attachment in storage');
                            })
                        }
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('in delete file attachment for plate item');
                    })
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    addFileAttachment(req, res) {
        const itemToGet = req.params.id;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item add file attachment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    if (!plateItem) {
                        super.sendUnknownError(res);
                    } else {
                        // file size per item
                        // depending on user if they're gold or not
                        Team.getByIdForUser(platter.team && platter.team.toString(), user).then((team) => {
                            plateFileHandler.uploadPlateItemFileAttachments(user, team, plateItem, req).then((fileSystemInfos) => {
                                if (!fileSystemInfos || !fileSystemInfos.length) {
                                    super.sendUnknownError(res);
                                } else {
                                    plateItem.addFileAttachments(user, fileSystemInfos).then((simpleFileAttachments) => {
                                        res.send(simpleFileAttachments);
                                        socketController.serverEventTeamPlateItemEdited(user, plateItem, platter);
                                        let fileAttachmentName = simpleFileAttachments && simpleFileAttachments.length ? simpleFileAttachments[0].fileName : '';
                                        Activity.createActivity(plate.id, platter, user, plateItem.id, platter.team, ServerActivityActionType.AddFileAttachment, plate.color, plateItem.title, plate.name, fileAttachmentName);
                                    }).catch(reason => super.sendUnknownError(res));
                                }
                            }).catch((reason) => {
                                super.sendUnknownError(res);
                            })
                        }).catch((reason) => {
                            super.sendUnknownError(res);
                        })
                    }
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    getFileAttachment(req, res) {
        const itemToGet = req.params.id;
        const attachmentId = req.params.attachmentId;
        if (!itemToGet || attachmentId) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            super.verifyUserLoggedIn(req, res, 'plate item get attachment').then((user: IUser) => {
                PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                    let attachment = plateItem.getAttachmentById(attachmentId);
                    if (!attachment) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_NoSuchFile
                        })
                    } else {
                        // plateFileHandler.getPlateItemFileAttachmentPath(plateItem.id, attachment.id).then((filePath) => {
                        //     res.type(`application/octet-stream`).sendFile(filePath);
                        // }).catch((reason) => {
                        //     super.sendUnknownError(res);
                        // })
                        res.sendStatus(200);
                    }
                }).catch((err) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                    });
                    Config.HandleServerSideError('user does not have access for plate item');
                });
            }).catch(reason => Config.HandleServerSideError(reason))
        }
    }

    updateItem(req, res) {
        const itemToGet = req.params.id;
        const newDetails: ISimplePlateItem = req.body;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            if (!newDetails == null) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_MissingParameters
                });
            } else {
                super.verifyUserLoggedIn(req, res, 'plate item update').then((user: IUser) => {
                    PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                        let oldPlateId = plateItem.plate;
                        let oldHeaderId = plateItem.header;
                        plateItem.updatePlateItem(newDetails, user, platter, plate).then((savedPlateItem) => {
                            res.sendStatus(200);
                            if (oldPlateId === savedPlateItem.plate) {
                                socketController.serverEventTeamPlateItemEdited(user, plateItem, platter);
                            } else {
                                socketController.serverEventTeamPlateItemRemovedFromPlate(user, plateItem, oldHeaderId, oldPlateId, platter);
                                socketController.serverEventTeamPlateItemAdded(user, plateItem, platter);
                            }
                        }).catch((reason) => {
                            super.sendUnknownError(res);
                            Config.HandleServerSideError(reason);
                        });
                    }).catch((err) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                        Config.HandleServerSideError('user does not have access for plate item');
                    });
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    updateItemPosition(req, res) {
        const itemToGet = req.params.id;
        const newPosition: number = +req.body.pos;
        const newHeader = req.body.header;
        const markedDone = req.body.markedDone;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            if (newPosition == null || newPosition == undefined) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_MissingParameters
                });
            } else {
                super.verifyUserLoggedIn(req, res, 'Position plate item update').then((user: IUser) => {
                    PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                        let oldHeader = plateItem.header;
                        plateItem.updatePosition(user, newPosition, newHeader, markedDone, plate, platter).then((savedPlateItem) => {
                            socketController.serverEventTeamPlateItemPositionUpdated(user, savedPlateItem, oldHeader, platter);
                            res.sendStatus(200);
                        }).catch((reason) => {
                            super.sendUnknownError(res);
                            Config.HandleServerSideError(reason);
                        });
                    }).catch((err) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                        Config.HandleServerSideError('user does not have access for plate item');
                    });
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

    updateMetrics(req, res) {
        const itemToGet = req.params.id;
        const metric: ISimpleMetric = req.body;
        if (!itemToGet) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        } else {
            if (!metric) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_MissingParameters
                });
            } else {
                super.verifyUserLoggedIn(req, res, 'plate item update metric').then((user: IUser) => {
                    PlateItem.getByIdForUser(itemToGet, user).then(([platter, plate, plateItem]) => {
                        plateItem.createOrUpdateMetric(metric, user, platter, plate).then((savedPlateItem) => {
                            res.sendStatus(200);
                            socketController.serverEventTeamPlateItemEdited(user, plateItem, platter)
                        }).catch((reason) => {
                            super.sendUnknownError(res);
                            Config.HandleServerSideError(reason);
                        });
                    }).catch((err) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                        });
                        Config.HandleServerSideError('user does not have access for plate item');
                    });
                }).catch(reason => Config.HandleServerSideError(reason))
            }
        }
    }

}

export const plateItemsController = new PlateItemsController();