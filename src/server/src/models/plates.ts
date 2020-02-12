import * as mongoose from "mongoose";
import * as Q from "q";
import {IUser} from "./users";
import {Resource} from "../resources/resource-service";
import {PlateItem} from "./plate-item";
import {Team, PermissionUserType, PERMISSION_KEYS} from "./teams";
import {Platter, IPlatter} from "./platters";
import {socketController} from "../socket/socket-controller";
import {Activity, ServerActivityActionType} from "./activity";

const VALIDATION = {
    NameLength: 100
}

// IF you change any of these, search for BuiltInColors across the project.
// I got lazy with the replication of this, particularly in the Sass
export const BuiltInColors = [
    '#0066CC',
    '#DB2828',
    '#F2711C',
    '#FBBD08',
    '#B5CC18',
    '#21BA45',
    '#00B5AD',
    '#2185D0',
    '#6435C9',
    '#A333C8',
    '#E03997',
    '#A5673F',
    '#767676',
    '#1B1C1D'
]

const DEFAULT_NATIVE_PLATE_HEADERS = [ { name: Resource.Translatable.DEFAULTS_GOALS }, { name: Resource.Translatable.DEFAULTS_TASKS }, { name: Resource.Translatable.DEFAULTS_DONE, isDoneHeader: true } ];

export interface IPlatePermissions {
    cPltIms: PermissionUserType,
    mPltIms: PermissionUserType,
    moveImToDiff: PermissionUserType,
    aPltIms: PermissionUserType
}

export interface ISimplePlateHeader {
    id: string;
    name: string;
    isDoneHeader: boolean;
    isHidden?: boolean;
    itemsCanBeDone?: boolean;
    isFullyHidden?: boolean;
}
export interface IPlateHeader {
    name: string;
    id?: string;
    isDoneHeader?: boolean;
    isHidden?: boolean;
    itemsCanBeDone?: boolean;
    isFullyHidden?: boolean;
}

export interface ISimplePlate {
    id: string;
    name: string;
    platter: string;
    owner: string;
    color: string;
    headers: IPlateHeader[];
    created: number;
    archived: boolean;
    listPos: number;
}
export interface IPlate extends mongoose.Document {
    id: string;
    name: string;
    platter: string;
    teams: string[]; // OLD! This is only used for updating
    owner: string;
    color: string;
    headers: IPlateHeader[];
    created: number;
    archived: boolean;
    listPos: number;
}
const PlateSchema = new mongoose.Schema({
    name: String,
    platter: mongoose.Schema.Types.ObjectId,
    owner: mongoose.Schema.Types.ObjectId,
    teams: [mongoose.Schema.Types.ObjectId], // OLD! This is only used for updating
    color: {
        type: String,
        default: '#0066CC'
    },
    archived: {
        type: Boolean,
        default: false
    },
    headers: [
        {
            name: String,
            isDoneHeader: {
                type: Boolean,
                default: false
            },
            isHidden: { // Should be called isMinimized
                type: Boolean,
                default: false
            },
            itemsCanBeDone: {
                type: Boolean,
                default: true
            },
            isFullyHidden: {
                type: Boolean,
                default: false
            }
        }
    ], // Goals, Tasks
    created: {
        type: Date,
        default: Date.now
    },
    listPos: Number
});

export interface IPlateStatic extends mongoose.Model<IPlate> {}

export interface IPlateStatic{ createPlate(user: IUser, newPlateBody: ISimplePlate, platter: IPlatter): Q.Promise<IPlate> }
PlateSchema.statics.createPlate = function(user: IUser, newPlateBody: ISimplePlate, platter: IPlatter): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();

    platter.checkPermission(user, PERMISSION_KEYS.CREATE_PLATES).then((platter) => {
        let name = newPlateBody.name;
        if (!name) {
            deferred.reject('name required');
        } else {
            let plate = new Plate();
            plate.name = name;
            plate.owner = user.id;
            plate.headers = DEFAULT_NATIVE_PLATE_HEADERS;

            plate.platter = platter.id;

            if (newPlateBody.color) {
                plate.color = newPlateBody.color;
            }

            plate.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(plate);
                }
            });
        }
    }).catch((reason) => {
        deferred.reject('user cannot create plates for this platter')
    })

    return deferred.promise;
}


export interface IPlatterPlatePosition {
    id: string,
    listPos: number
}

/**
 * Internal won't alert the socket. Used when we have to manipulate indices when moving Plate to Platter
 */
export interface IPlateStatic{ updatePositionsForPlatter(user: IUser, platter: IPlatter, positions: IPlatterPlatePosition[], internal?: boolean): Q.Promise<IPlate> }
PlateSchema.statics.updatePositionsForPlatter = function(user: IUser, platter: IPlatter, positions: IPlatterPlatePosition[], internal?: boolean): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    // This is allowed to be empty if moving a plate out of a platter that only had that plate
    positions = positions || [];
    const numPlatesNeedUpdate = positions.length;
    let numPlatesUpdated = 0;
    platter.checkPermission(user, PERMISSION_KEYS.MODIFY_PLATES).then((platter) => {
        for (let position of positions) {
            Plate.update(
                {
                    _id: position.id,
                    platter: platter.id
                },
                {
                    listPos: position.listPos
                },
                (err, num) => {
                    if (err) {
                        // If there were no plates found for that id (I think)
                        deferred.reject(err);
                    } else {
                        numPlatesUpdated++;
                        if (numPlatesUpdated >= numPlatesNeedUpdate) {
                            deferred.resolve(thisPlate);
                            if (!internal) {
                                socketController.serverEventPlateListPositionUpdated(user, positions, platter);
                            }
                        }
                    }
                }
            )
        }
    }).catch((reason) => {
        deferred.reject('User does not have permission');
    });
    return deferred.promise;
}

export interface IPlate{       movePlateToPlatter(user: IUser, oldPlatter: IPlatter, newPlatterId: string, oldPlatterPositions: IPlatterPlatePosition[], newPlatterPositions: IPlatterPlatePosition[]): Q.Promise<IPlate> }
PlateSchema.methods.movePlateToPlatter = function(user: IUser, oldPlatter: IPlatter, newPlatterId: string, oldPlatterPositions: IPlatterPlatePosition[], newPlatterPositions: IPlatterPlatePosition[]): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;
    if (!newPlatterPositions || !newPlatterPositions.length) {
        deferred.resolve(thisPlate);
    } else {
        if (!newPlatterId) {
            deferred.reject('new platter id not given');
        } else {
            Platter.getByIdForUser(newPlatterId, user).then((newPlatter) => {
            	if (!newPlatter) {
            	    deferred.reject('Platter not found for user')
                } else {
                    // Check that the user can move from the old Platter (right now we just use archive)
                    oldPlatter.checkPermission(user, PERMISSION_KEYS.ARCHIVE_PLATES).then((oldPlatter) => {
                        // Check that the user can add to the new Platter
                        newPlatter.checkPermission(user, PERMISSION_KEYS.CREATE_PLATES).then((newPlatter) => {
                            thisPlate.platter = newPlatterId;
                            thisPlate.save((err) => {
                                if (err) {
                                	deferred.reject(err);
                                } else {
                                    // Then update the old platter's positions
                                    Plate.updatePositionsForPlatter(user, oldPlatter, oldPlatterPositions, true).then((status) => {
                                        // And the new
                                        Plate.updatePositionsForPlatter(user, newPlatter, newPlatterPositions, true).then((status) => {
                                            deferred.resolve(thisPlate);
                                            Activity.createActivity(thisPlate.id, newPlatter, user, thisPlate.id, newPlatter.team, ServerActivityActionType.PlateMovedPlatters, thisPlate.color, oldPlatter.name, thisPlate.name, newPlatter.name);
                                            // Refresh the Plate to get the new position
                                            Plate.findById(thisPlate.id, (err, plate) => {
                                                if (err) {
                                                    // Uh oh!
                                                } else {
                                                    if (plate) {
                                                        socketController.serverEventPlateMovedPlatters(user, plate, oldPlatter, oldPlatterPositions);
                                                        socketController.serverEventTeamPlateAdded(user, newPlatter, plate);
                                                    }
                                                }
                                            })
                                        }).catch((reason) => {
                                            deferred.reject(reason);
                                        })
                                    }).catch((reason) => {
                                        deferred.reject(reason);
                                    })
                                }
                            })
                        }).catch((reason) => {
                            deferred.reject(reason);
                        })
                    }).catch((reason) => {
                        deferred.reject(reason);
                    })
                }
            }).catch((reason) => {
                deferred.reject(reason);
            })
        }
    }
    return deferred.promise;
}

/**
 * Returns Plate by getting Platters the user has access to
 */
export interface IPlateStatic{ getAllForUser(user: IUser): Q.Promise<IPlate[]> }
PlateSchema.statics.getAllForUser = function(user: IUser): Q.Promise<IPlate[]> {
    let deferred = Q.defer<IPlate[]>();
    Platter.getAllForUser(user, null, true).then((platterIds) => {
        Plate.find({
            platter: { $in: platterIds },
            archived: false
        }, (err, plates) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(plates);
            }
        });
    }).catch((reason) => {
        deferred.reject(reason);
    })

    return deferred.promise;
}

export interface IPlateStatic{ getAllForPlatter(platter: IPlatter): Q.Promise<IPlate[]> }
PlateSchema.statics.getAllForPlatter = function(platter: IPlatter): Q.Promise<IPlate[]> {
    let deferred = Q.defer<IPlate[]>();
    Plate.find({
        platter: platter.id,
        archived: {
            $ne: true
        }
    }, (err, plates) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(plates);
        }
    });
    return deferred.promise;
}

export interface IPlateStatic{ createDefaultPlate(user: IUser, platter: IPlatter): Q.Promise<IPlate> }
PlateSchema.statics.createDefaultPlate = function(user: IUser, platter: IPlatter): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();

    let newPlate = new Plate();
    newPlate.name = platter.team ? Resource.Translatable.DEFAULTS_TeamFirstPlate : Resource.Translatable.DEFAULTS_MyFirstPlate;
    newPlate.owner = user.id;
    newPlate.headers = DEFAULT_NATIVE_PLATE_HEADERS;
    newPlate.color = platter.color;
    newPlate.platter = platter.id;
    newPlate.save((err) => {
    	if (err) {
    		deferred.reject(err);
    	} else {
            PlateItem.defaultPlateItems(newPlate, user, !!platter.team).then((items) => {
                deferred.resolve(newPlate);
            }).catch((reason) => {
                deferred.reject(err);
            })
    	}
    })

    return deferred.promise;
}

export interface IPlateStatic{ getByIdForUser(user: IUser, id: string): Q.Promise<[IPlate, IPlatter]> }
PlateSchema.statics.getByIdForUser = function(user: IUser, id: string): Q.Promise<[IPlate, IPlatter]> {
    let deferred = Q.defer<[IPlate, IPlatter]>();

    Plate.findById(id, function(err, plate) {
        Platter.getByIdForUser(plate.platter, user).then((platter) => {
            if (!platter) {
                console.error('no platter found');
            } else {
                if (!platter.doesUserHaveAccess(user)) {
                    deferred.reject('User doesn\'t have permission for plate');
                } else {
                    deferred.resolve([plate, platter]);
                }
            }

        }).catch((reason) => {
            deferred.reject(reason);
        })
    });

    return deferred.promise;
}

export interface IPlateStatic{ VerifyParameters      (newDetails: ISimplePlate): string }
PlateSchema.statics.VerifyParameters = function(newDetails: ISimplePlate): string {
    return null;
}

function assignGenericPlatterToPlates(deferred, noPlatterPlates: IPlate[], user: IUser) {
    if (!noPlatterPlates.length) {
        deferred.resolve(true);
    } else {
        let noPlatterPlate = noPlatterPlates.pop();
        // If the plate was assigned to a team, assign the platter to the new platter named after the team. Then remove teams from that plate
        if (noPlatterPlate.teams && noPlatterPlate.teams.length) {
            // Assume one team
            Team.getByIdForUser(noPlatterPlate.teams[0].toString(), user).then((team) => {
                Platter.getAllForTeam(team).then((teamPlatters) => {
                    // If the team has even one platter, we assign it to that one
                    if (teamPlatters && teamPlatters.length) {
                        noPlatterPlate.platter = teamPlatters[0].id;
                        noPlatterPlate.teams = null;
                        noPlatterPlate.save((err) => {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                assignGenericPlatterToPlates(deferred, noPlatterPlates, user);
                            }
                        });
                    } else {
                        // Team did not have any platters, create a new one
                        let teamName = team.name + ' ' + Resource.Translatable.DEFAULTS_PLATTER;
                        let teamColor = team.color;
                        Platter.createPlatterFromNameOnly(user, teamName, teamColor, team, noPlatterPlate.owner).then((platter) => {
                            noPlatterPlate.platter = platter.id;
                            noPlatterPlate.teams = null;
                            noPlatterPlate.save((err) => {
                                if (err) {
                                    deferred.reject(err);
                                } else {
                                    assignGenericPlatterToPlates(deferred, noPlatterPlates, user);
                                }
                            });
                        }).catch((reason) => {
                            deferred.reject(reason);
                        });
                    }
                }).catch((reason) => {
                    deferred.reject(reason);
                });
            }).catch((reason) => {
                deferred.reject(reason);
            });
        } else {
            // The plate did not have a team - assign to a user's platter or create a new user platter
            Platter.getAllForUser(user, true).then((userPlatters) => {
                // If the user has even one platter, we assign it to that one
                if (userPlatters && userPlatters.length) {
                    noPlatterPlate.platter = userPlatters[0].id;
                    noPlatterPlate.save((err) => {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            assignGenericPlatterToPlates(deferred, noPlatterPlates, user);
                        }
                    })
                } else {
                    // User did not have any platters, create a new one
                    let newName = Resource.Translatable.DEFAULTS_PLATTER_NAME;
                    Platter.createPlatterFromNameOnly(user, newName).then((platter) => {
                        noPlatterPlate.platter = platter.id;
                        noPlatterPlate.save((err) => {
                            if (err) {
                                deferred.reject(err);
                            } else {
                                assignGenericPlatterToPlates(deferred, noPlatterPlates, user);
                            }
                        });
                    }).catch((reason) => {
                        deferred.reject(reason);
                    });
                }
            }).catch((reason) => {
                deferred.reject(reason);
            });
        }
    }
    return deferred.promise;
}

export interface IPlateStatic{ upgradeToPlattersForUserIfNeeded      (user: IUser): Q.Promise<boolean> }
PlateSchema.statics.upgradeToPlattersForUserIfNeeded = function(user: IUser): Q.Promise<boolean> {
    let deferred = Q.defer<boolean>();
    let teamIdsArray = user.getTeamIds();
    Plate.find({
        platter: null,
        $or: [
            {
                owner: user.id
            },
            {
                teams: { $in: teamIdsArray }
            }
        ]
    }, (err, noPlatterPlates) => {
        if (err) {
            deferred.reject(err);
        } else {
            if (!noPlatterPlates || !noPlatterPlates.length) {
                // User does not need to upgrade
                deferred.resolve(true);
            } else {
                // One by one, assign Platter to Plate
                let platterDeferred = Q.defer<boolean>();
                assignGenericPlatterToPlates(platterDeferred, noPlatterPlates, user).then((booleanStatus) => {
                    // Now tell the user in the db that they've been upgraded
                    user.didUpgradeToPlatters().then((user) => {
                        deferred.resolve(booleanStatus);
                    }).catch((reason) => {
                        deferred.reject(reason);
                    })
                }).catch((reason) => {
                    deferred.reject(reason);
                })
            }
        }
    });

    return deferred.promise;
}

export interface IPlate{ toggleDoneHeaderHide(user: IUser, hidden: boolean): Q.Promise<IPlate> }
PlateSchema.methods.toggleDoneHeaderHide = function(user: IUser, hidden: boolean): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    for (let header of thisPlate.headers) {
        if (header.isDoneHeader) {
            header.isHidden = hidden;
            break;
        }
    }

    thisPlate.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisPlate);
        }
    })

    return deferred.promise;
}

export interface IPlate{ toggleDoneHeaderFullyHide(user: IUser, hidden: boolean): Q.Promise<IPlate> }
PlateSchema.methods.toggleDoneHeaderFullyHide = function(user: IUser, hidden: boolean): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    for (let header of thisPlate.headers) {
        if (header.isDoneHeader) {
            header.isFullyHidden = hidden;
            break;
        }
    }

    thisPlate.save((err) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(thisPlate);
        }
    })

    return deferred.promise;
}

export interface IPlate{ newHeader(user: IUser, name: string, platter: IPlatter): Q.Promise<ISimplePlateHeader> }
PlateSchema.methods.newHeader = function(user: IUser, name: string, platter: IPlatter): Q.Promise<ISimplePlateHeader> {
    let deferred = Q.defer<ISimplePlateHeader>();
    let thisPlate: IPlate = this;

    let valid = true;
    if (!name) {
        valid = false;
    } else if (name.trim().length > VALIDATION.NameLength) {
        valid = false;
    }

    if (!valid) {
        deferred.reject('parameters not valid');
    } else {
        name = name.trim();
        let duplicateHeader = false;
        for (let header of thisPlate.headers) {
            if (header.name === name) {
                duplicateHeader = true;
                break;
            }
        }
        if (duplicateHeader) {
            deferred.reject('Header name already exists');
        } else {
            thisPlate.headers.push({
                name: name
            });
            thisPlate.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    let foundHeader: IPlateHeader = null;
                    for (let header of thisPlate.headers) {
                        if (header.name === name) {
                            foundHeader = header;
                            break;
                        }
                    }
                    if (!foundHeader) {
                        deferred.reject('unknown error adding header');
                    } else {
                        deferred.resolve(simpleHeader(foundHeader));
                        Activity.createActivity(thisPlate.id, platter, user, thisPlate.id, platter.team, ServerActivityActionType.NewHeader, thisPlate.color, foundHeader.name, thisPlate.name);
                    }
                }
            })
        }
    }

    return deferred.promise;
}

export interface IPlate{ deleteHeader(user: IUser, headerId: string, platter: IPlatter): Q.Promise<IPlate> }
PlateSchema.methods.deleteHeader = function(user: IUser, headerId: string, platter: IPlatter): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    let foundHeader: IPlateHeader = null;
    for (let i=0; i < thisPlate.headers.length; i++) {
        let header = thisPlate.headers[i];
        if (header.id === headerId && !header.isDoneHeader) {
            foundHeader = header;
            thisPlate.headers.splice(i, 1);
            break;
        }
    }

    if (!foundHeader) {
        deferred.reject('No such header found');
    } else {
        thisPlate.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisPlate);
                Activity.createActivity(thisPlate.id, platter, user, thisPlate.id, platter.team, ServerActivityActionType.RemoveHeader, thisPlate.color, foundHeader.name, thisPlate.name);
            }
        })
    }

    return deferred.promise;
}

export interface IPlate{ toggleItemsCanBeMarkedAsDone(user: IUser, headerId: string, itemsCanBeMarkedAsDone: boolean): Q.Promise<IPlate> }
PlateSchema.methods.toggleItemsCanBeMarkedAsDone = function(user: IUser, headerId: string, itemsCanBeMarkedAsDone: boolean): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    let foundHeader = false;
    for (let header of thisPlate.headers) {
        if (header.id === headerId) {
            header.itemsCanBeDone = itemsCanBeMarkedAsDone;
            foundHeader = true;
            break;
        }
    }

    if (!foundHeader) {
        deferred.reject('No such header found');
    } else {
        thisPlate.save((err) => {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(thisPlate);
            }
        })
    }

    return deferred.promise;
}

export interface IPlate{ updateHeaderName(user: IUser, headerId: string, name: string, platter: IPlatter): Q.Promise<IPlate> }
PlateSchema.methods.updateHeaderName = function(user: IUser, headerId: string, name: string, platter: IPlatter): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;

    let valid = true;
    if (!name) {
        valid = false;
    } else if (name.trim().length > VALIDATION.NameLength) {
        valid = false;
    }

    if (!valid) {
        deferred.reject('name not valid')
    } else {
        name = name.trim();
        let foundHeader: IPlateHeader = null;
        for (let header of thisPlate.headers) {
            if (header.id === headerId) {
                header.name = name;
                foundHeader = header;
                break;
            }
        }
        if (!foundHeader) {
            deferred.reject('No such header found');
        } else {
            thisPlate.save((err) => {
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(thisPlate);
                    Activity.createActivity(thisPlate.id, platter, user, thisPlate.id, platter.team, ServerActivityActionType.ChangePlateHeader, thisPlate.color, foundHeader.name, thisPlate.name);
                }
            })
        }
    }

    return deferred.promise;
}

export interface IPlate{ updatePlate(user: IUser, platter: IPlatter, newPlateBody: ISimplePlate): Q.Promise<IPlate> }
PlateSchema.methods.updatePlate = function(user: IUser, platter: IPlatter, newPlateBody: ISimplePlate): Q.Promise<IPlate> {
    let deferred = Q.defer<IPlate>();
    let thisPlate: IPlate = this;
    let nameOrColorChange = false;
    let archiveChange = false;

    let name = newPlateBody.name;
    if (name !== thisPlate.name) {
        nameOrColorChange = true;
    }

    let color = newPlateBody.color;
    if (color !== thisPlate.color) {
        nameOrColorChange = true;
    }

    let archived = newPlateBody.archived;
    if (archived != thisPlate.archived) {
        archiveChange = true;
    }

    // Could certainly use some optimization. Should be able to pass in array of strings to checkPermission
    if (!nameOrColorChange && !archiveChange) {
        deferred.resolve(thisPlate);
    } else {
        if (nameOrColorChange && archiveChange) {
            platter.checkPermission(user, PERMISSION_KEYS.MODIFY_PLATES).then((platter) => {
                thisPlate.name = name;
                thisPlate.color = color;
                thisPlate.archived = archived;
                platter.checkPermission(user, PERMISSION_KEYS.ARCHIVE_PLATES).then((platter) => {
                    thisPlate.save((err) => {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            deferred.resolve(thisPlate);
                            socketController.serverEventTeamPlateArchived(user, thisPlate, platter);
                        }
                    })
                }).catch(reason => deferred.reject('User does not have permission'))
            }).catch((reason) => {
                deferred.reject('User does not have permission');
            });
        } else if (nameOrColorChange) {
            platter.checkPermission(user, PERMISSION_KEYS.MODIFY_PLATES).then((platter) => {
                thisPlate.name = name;
                thisPlate.color = color;
                thisPlate.save((err) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve(thisPlate);
                    }
                });
            }).catch((reason) => {
                deferred.reject('User does not have permission');
            });
        } else if (archiveChange) {
            platter.checkPermission(user, PERMISSION_KEYS.ARCHIVE_PLATES).then((platter) => {
                thisPlate.archived = archived;
                thisPlate.save((err) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve(thisPlate);
                        socketController.serverEventTeamPlateArchived(user, thisPlate, platter);
                    }
                })
            }).catch((reason) => {
                deferred.reject('User does not have permission');
            });
        }
    }

    return deferred.promise;
}

export interface IPlate{ simple      (): ISimplePlate }
PlateSchema.methods.simple = function(): ISimplePlate {
    return {
        id: this._id,
        name: this.name,
        platter: this.platter,
        owner: this.owner,
        headers: simpleHeaders(this.headers),
        created: this.created,
        color: this.color,
        archived: this.archived,
        listPos: this.listPos
    }
}

function simpleHeader(header: IPlateHeader): ISimplePlateHeader {
    return {
        id: header.id,
        name: header.name,
        isDoneHeader: header.isDoneHeader,
        isHidden: header.isHidden,
        itemsCanBeDone: header.itemsCanBeDone,
        isFullyHidden: header.isFullyHidden
    }
}

function simpleHeaders(headers: IPlateHeader[]): ISimplePlateHeader[] {
    let ret: ISimplePlateHeader[] = [];
    for (let header of headers) {
        ret.push(simpleHeader(header))
    }
    return ret;
}

mongoose.model('Plate', PlateSchema);
export const Plate: IPlateStatic = <IPlateStatic>mongoose.model('Plate');
