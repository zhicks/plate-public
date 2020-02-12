import {IUser} from "../models/users";
import {Config} from "../config/config-service";
import {BaseController} from "./base-controller";
import {Resource} from "../resources/resource-service";
import {ConnectedApp, ISimpleAutomationRule} from "../models/connectedapps";
import {ConnectedAppItem} from "../models/connectedapp-items";

class ConnectedAppsController extends BaseController {

    getAllForUser(req, res) {
        super.verifyUserLoggedIn(req, res, 'Connected app get').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getConnectedAppsForUser(user).then((connectedApps) => {
                    let simpleConnectedApps = [];
                    for (let connectedApp of connectedApps) {
                        simpleConnectedApps.push(connectedApp.simple());
                    }
                    res.send(simpleConnectedApps);
                }).catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('Error in getting connected apps for user');
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    getItemsForConnectedApp(req, res) {
        let connectedAppId = req.params.connectedAppId;
        super.verifyUserLoggedIn(req, res, 'Connected app item get').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    ConnectedAppItem.getItemsForConnectedApp(connectedApp).then((connectedAppItems) => {
                        if (!connectedAppItems || !connectedAppItems.length) {
                            res.send([]);
                        } else {
                            let simpleConnectedAppItems = [];
                            for (let connectedAppItem of connectedAppItems) {
                                simpleConnectedAppItems.push(connectedAppItem.simple());
                            }
                            res.send(simpleConnectedAppItems);
                        }
                    })
                }).catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    /**
     * Sets a temporary token in preparation for hooking up Slack, and sends back slack URL. When Slack calls us back,
     * we look up this token in the database.
     * @param req
     * @param res
     */
    slackAuth(req, res) {
        let connectedAppId = req.params.connectedAppId;
        if (!connectedAppId) {
            res.sendStatus(400);
            return;
        }
        super.verifyUserLoggedIn(req, res, 'Connected app get slack url').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    connectedApp.saveTemporarySlackToken().then((token) => {
                        const slackProvider = Config.Keys.Providers.Slack;
                        const clientId = slackProvider.CLIENT_ID;
                        const scope = slackProvider.SCOPES;
                        const redirectUri = slackProvider.CALLBACK_URL;
                        const state = token;
                        const url = `https://slack.com/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
                        res.send(url);
                    }).catch((reason) => {
                        res.sendStatus(500);
                    })
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    /**
     * Sets a temporary token in preparation for hooking up Gmail and returns the url. When Gmail calls us back, we look up this
     * token in the database. Returns the URL for Gmail auth.
     * @param req
     * @param res
     */
    gmailAuth(req, res) {
        let connectedAppId = req.params.connectedAppId;
        if (!connectedAppId) {
            res.sendStatus(400);
            return;
        }
        super.verifyUserLoggedIn(req, res, 'Connected app get gmail url').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    connectedApp.saveTemporaryGmailToken().then((token) => {
                        const googleProvider = Config.Keys.Providers.Google;
                        const gmailProvider = Config.Keys.Providers.Gmail;
                        const clientId = googleProvider.CLIENT_ID;
                        const scope = gmailProvider.SCOPES;
                        const redirectUri = gmailProvider.CALLBACK_URL;
                        const state = token;
                        //https://developers.google.com/identity/protocols/OAuth2WebServer
                        const url = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}&access_type=offline&prompt=select_account consent&include_granted_scopes=true`;
                        res.send(url);
                    }).catch((reason) => {
                        res.sendStatus(500);
                    })
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    updateConnectedApp(req, res) {
        let connectedAppId = req.params.connectedAppId;
        super.verifyUserLoggedIn(req, res, 'Connected app update').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                let newConnectedAppBody = req.body;
                const badParameters = ConnectedApp.verifyParameters(newConnectedAppBody);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                } else {
                    ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                        connectedApp.updateConnectedApp(newConnectedAppBody, user).then((connectedApp) => {
                            res.sendStatus(200);
                        }).catch((reason) => {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('Error in connected app update');
                        })
                    }).catch((reason) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })
                }
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    newConnectedApp(req, res) {
        super.verifyUserLoggedIn(req, res, 'Connected app save').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                let newConnectedAppBody = req.body;
                const badParameters = ConnectedApp.verifyParameters(newConnectedAppBody);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                } else {
                    ConnectedApp.newConnectedAppForUser(newConnectedAppBody, user).then((connectedApp) => {
                        res.send(connectedApp.simple());
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('Error in save connected app for user');
                    })
                }
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    createAutomationRule(req, res) {
        let connectedAppId = req.params.connectedAppId;
        if (!connectedAppId) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        }
        super.verifyUserLoggedIn(req, res, 'createAutomationRule').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                let newAutomationRuleBodyBody: ISimpleAutomationRule = req.body;
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    connectedApp.addAutomationRule(user, newAutomationRuleBodyBody).then((simpleAutomationRule) => {
                        res.send(simpleAutomationRule);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('Error in createAutomationRule');
                    })
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    deleteAutomationRule(req, res) {
        let connectedAppId = req.params.connectedAppId;
        let automationRuleId = req.params.automationRuleId;
        if (!connectedAppId || !automationRuleId) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingId
            });
            return;
        }
        super.verifyUserLoggedIn(req, res, 'deleteAutomationRule').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    connectedApp.removeAutomationRule(user, automationRuleId).then((status) => {
                        res.sendStatus(200);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('Error in deleteAutomationRule');
                    })
                }).catch((reason) => {
                    res.status(401).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    newConnectedAppItem(req, res) {
        let connectedAppId = req.params.connectedAppId;
        super.verifyUserLoggedIn(req, res, 'Connected app item save').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                let newConnectedAppItemBody = req.body;
                const badParameters = ConnectedAppItem.verifyParameters(newConnectedAppItemBody);
                if (badParameters) {
                    res.status(400).json({
                        message: Resource.Make(Resource.Translatable.ERROR_UnknownProperty, badParameters)
                    });
                } else {
                    ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                        ConnectedAppItem.newConnectedAppItemForUser(newConnectedAppItemBody, connectedApp, user).then((connectedAppItem) => {
                            res.send(connectedAppItem.simple());
                        }).catch((reason) => {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('Error in save connected app item for user');
                        })
                    }).catch((reason) => {
                        res.status(401).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                    })

                }
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

    // Does NOT search through items in the DB database
    searchConnectedApp(req, res) {
        let connectedAppId = req.params.connectedAppId;
        let query = req.query.query;
        if (!query) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_MissingParameters
            });
            return;
        }
        if (query.length > 50) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_SearchQueryTooLong
            });
            return;
        }
        const maxResults = req.query.maxResults;
        super.verifyUserLoggedIn(req, res, 'Connected app item search').then((user: IUser) => {
            if (!super.userIdMatchesRequestId(user, req.params.userId)) {
                res.status(401).json({
                    message: Resource.Translatable.ERROR_UserDoesntHaveAccess
                });
            } else {
                ConnectedApp.getByIdForUser(user, connectedAppId).then((connectedApp) => {
                    connectedApp.search(query, maxResults).then((results) => {
                    	res.send(results);
                    }).catch((reason) => {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        Config.HandleServerSideError('error in searching for query for connected app');
                    })
                }).catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                })
            }
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

}

export const connectedAppsController = new ConnectedAppsController();