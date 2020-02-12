import * as express from "express";
import * as passport from "passport";
import * as mongoose from "mongoose";
import * as request from "request";
import { Config } from '../../config/config-service';
import { Resource } from '../../resources/resource-service';

import {socketController} from "../../socket/socket-controller";
import {IUser, IUserStatic} from '../../models/users';
import {InviteLinkDetails, teamController } from "../teams-controller";
import {ConnectedApp} from "../../models/connectedapps";
import {GmailClientStatic} from "../../integrations/slack/gmail-client";
import {SlackClientStatic} from "../../integrations/slack/slack-client";
const User: IUserStatic = <IUserStatic>mongoose.model('User');

// TODO Interface this, or pass it in or something
//let oauth2Client = global['PlateGlobals'].gmailAuth;

const EMAIL_REG_EXP = /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

function saveAndSendUser(user: IUser, res: express.Response) {
    user.save((err) => {
        if (err) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_Unknown
            });
            Config.HandleServerSideError('in save user registration or login saveAndSendUser');
        } else {
            let token = user.generateJwt();
            res.status(200).json({
                token: token
            });
        }
    });
}

// Standard Plate registration
// Registration for extra providers found in passport.js
export function register(req: express.Request, res: express.Response) {

    // TODO - throttle requests from specific IP

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    // For team invite
    let inviteDetailsJson: string = req.body.inviteDetails;
    let inviteDetails: InviteLinkDetails = null;
    try {
        if (inviteDetailsJson) {
            inviteDetails = JSON.parse(inviteDetailsJson);
        }
    } catch (e) {
        // Do nothing
    }

    if (!name || !email || !password) {
        res.status(400).json({
            message: Resource.Translatable.ERROR_NameEmailAndPassRequired
        });
        res.redirect('/register');
        return;
    }

    if (!EMAIL_REG_EXP.test(email)) {
        res.status(400).json({
            message: Resource.Translatable.ERROR_InvalidEmail
        });
        res.redirect('/register');
        return;
    }

    if (password.length < 6) {
        res.status(400).json({
            message: Resource.Translatable.ERROR_PasswordMustBeAtLeastSixCharacters
        });
        res.redirect('/register');
        return;
    }

    User.findByEmail(email).then((user) => {
        // If the user already exists (including if registered via provider),
        // throw error.
        // Later if they want to set a password they can via "forgot password"
        if (user) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_UserAlreadyExists
            });
            return;
        } else {
            User.newUser(name, email, password, null).then((user) => {
                if (inviteDetails) {
                    // Verify
                    teamController.getInviteTokenFromUrlParams(inviteDetails.teamId, inviteDetails.inviterId, inviteDetails.inviteToken, true).then(([team, details]) => {
                        user.addTeam(team, {
                            id: inviteDetails.teamId,
                            role: 'user'
                        }).then((user) => {
                            saveAndSendUser(user, res);
                        }).catch((reason) => {
                            console.error('error in save user for invite token')
                        })
                    })
                        .catch((reason) => {
                            res.status(400).json({
                                message: Resource.Translatable.ERROR_Unknown
                            });
                            Config.HandleServerSideError('in save user registration accessing team');
                        })
                } else {
                    saveAndSendUser(user, res);
                }
            })

        }
    }).catch(Config.HandleServerSideError);
}

export function login(req, res, next) {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            res.status(404).json(err);
            return;
        }
        if (!user) {
            res.status(401).json(info);
            return;
        }

        if (user && user.email) {
            console.log('User login at ' + new Date().toString() + ': ' + user.email);
        }

        // For team invite
        let inviteDetailsJson: string = req.body.inviteDetails;
        let inviteDetails: InviteLinkDetails = null;
        try {
            if (inviteDetailsJson) {
                inviteDetails = JSON.parse(inviteDetailsJson);
            }
        } catch (e) {
            // Do nothing
        }

        if (!inviteDetails) {
            const token = user.generateJwt();
            res.status(200).json({
                token: token
            });
        } else {
            // Verify
            teamController.getInviteTokenFromUrlParams(inviteDetails.teamId, inviteDetails.inviterId, inviteDetails.inviteToken, true).then(([team, inviteLinkDetails]) => {
                // Make sure the user doesn't already
                user.addTeam(team, {
                    id: inviteDetails.teamId,
                    role: 'user'
                }, false);
                saveAndSendUser(user, res);
            })
                .catch((reason) => {
                    res.status(400).json({
                        message: Resource.Translatable.ERROR_Unknown
                    });
                    Config.HandleServerSideError('in login user accessing team invite');
                })
        }
    })(req, res, next);
}

export function logout(req, res, next) {
    req.logout();
    // update user last logged in / out
    // TODO Is there a status for logout?
    res.status(200).json({
        status: true
    });
}

export function refresh(req, res, next) {
    const id = req.userToken.id;
    User.getById(id).then((user) => {
        if (!user) {
            res.status(401).json({
                error: 'No user'
            })
        } else {
            const token = user.generateJwt();
            res.status(200).json({
                token: token
            });
        }

    }).catch(Config.HandleServerSideError);
}

export var google = passport.authenticate('google', { scope: ['profile', 'email'] });
export var googleCallback = passport.authenticate('google', { failureRedirect: '/login' } );
export var afterGoogleCallback = (req, res) => {
    // place token in p index
    const user = <IUser>req.user;
    const token = user.generateJwt();
    // put the token details in local storage
    // in auth callback check for that
    // then send it and update the user that way
    res.render('auth-callback', {
        token: token
    });
}

export const slackcallback = (req, res) => {
    let code = req.query.code;
    let state = req.query.state;
    if (!code || !state) {
        res.sendStatus(400);
        return;
    }
    ConnectedApp.findByTempSlackToken(state).then((connectedApp) => {
    	if (!connectedApp) {
    	    res.sendStatus(400);
        } else {
            if (!connectedApp._slack.tempTokenExpiration || connectedApp._slack.tempTokenExpiration < Date.now()) {
                res.sendStatus(400);
            } else {
                request.post('https://slack.com/api/oauth.access', {
                    form:{
                        client_id: Config.Keys.Providers.Slack.CLIENT_ID,
                        client_secret: Config.Keys.Providers.Slack.CLIENT_SECRET,
                        redirect_uri: Config.Keys.Providers.Slack.CALLBACK_URL,
                        code: code
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        res.sendStatus(500);
                    } else {
                        try {
                            let parsedBody = JSON.parse(body);
                            let accessToken = parsedBody.access_token;
                            let scope = parsedBody.scope;
                            connectedApp.saveSlackAccessToken(accessToken, scope).then((connectedApp) => {
                                SlackClientStatic.getUserInfo(accessToken).then((userInfo) => {
                                    connectedApp.initialConnectedAppName(userInfo.team + ' - Slack', userInfo.team).then((connectedApp) => {
                                        socketController.serverEventSlackAuthenticatedForConnectedApp(connectedApp);
                                        // If your response endpoint renders an HTML page, any resources on that page will be able to see the
                                        // authorization code in the URL. Scripts can read the URL directly, and all resources may be sent the
                                        // URL in the Referer HTTP header. Carefully consider if you want to send authorization credentials
                                        // to all resources on that page (especially third-party scripts such as social plugins and analytics).
                                        // To avoid this issue, we recommend that the server first handle the request, then redirect to
                                        // another URL that doesn't include the response parameters.
                                        res.redirect('/auth/didauth');
                                    });
                                }).catch((reason) => {
                                    res.sendStatus(500);
                                })

                            }).catch((reason) => {
                                res.sendStatus(500);
                            });
                        } catch (e) {
                            res.sendStatus(500);
                        }

                    }
                });
            }
        }
    }).catch((reason) => {
        res.sendStatus(400);
    })
}

export const gmailCallback = (req, res) => {
    let code = req.query.code;
    let state = req.query.state;
    if (!code || !state) {
        res.sendStatus(400);
        return;
    }
    ConnectedApp.findByTempGmailToken(state).then((connectedApp) => {
        if (!connectedApp) {
            res.sendStatus(400);
        } else {
            if (!connectedApp._gmail.tempTokenExpiration || connectedApp._gmail.tempTokenExpiration < Date.now()) {
                res.sendStatus(400);
            } else {
                request.post('https://www.googleapis.com/oauth2/v4/token', {
                    form:{
                        client_id: Config.Keys.Providers.Google.CLIENT_ID,
                        client_secret: Config.Keys.Providers.Google.CLIENT_SECRET,
                        redirect_uri: Config.Keys.Providers.Gmail.CALLBACK_URL,
                        code: code,
                        grant_type: 'authorization_code'
                    }
                }, (err, httpResponse, body) => {
                    if (err) {
                        res.sendStatus(500);
                    } else {
                        try {
                            let parsedBody = JSON.parse(body);
                            let accessToken = parsedBody.access_token;
                            let refreshToken = parsedBody.refresh_token;
                            let expiration = parsedBody.expires_in;
                            connectedApp.saveGmailRefreshToken(refreshToken).then((connectedApp) => {
                                connectedApp.saveGmailAccessToken(accessToken, expiration).then((connectedApp) => {
                                    GmailClientStatic.getProfile(accessToken).then((profile) => {
                                    	connectedApp.initialConnectedAppName(profile.emailAddress + ' - Gmail', profile.emailAddress).then((connectedApp) => {
                                            socketController.serverEventGmailAuthenticatedForConnectedApp(connectedApp);
                                            // If your response endpoint renders an HTML page, any resources on that page will be able to see the
                                            // authorization code in the URL. Scripts can read the URL directly, and all resources may be sent the
                                            // URL in the Referer HTTP header. Carefully consider if you want to send authorization credentials
                                            // to all resources on that page (especially third-party scripts such as social plugins and analytics).
                                            // To avoid this issue, we recommend that the server first handle the request, then redirect to
                                            // another URL that doesn't include the response parameters.
                                            res.redirect('/auth/didauth');
                                    	}).catch((reason) => {
                                            res.sendStatus(500);
                                    	});
                                    }).catch((reason) => {
                                        res.sendStatus(500);
                                    });
                                }).catch((reason) => {
                                    res.sendStatus(500);
                                })
                            }).catch((reason) => {
                                res.sendStatus(500);
                            });
                        } catch (e) {
                            res.sendStatus(500);
                        }

                    }
                });
            }
        }
    }).catch((reason) => {
        res.sendStatus(400);
    })
}

// Used for google callback since we can't attach on the req
// If invite_details are in local storage, this gets called
export function teamInvitePost(req, res, next) {
    const userToken = req.userToken;
    // For team invite
    let inviteDetailsJson: string = req.body.inviteDetails;
    let inviteDetails: InviteLinkDetails = null;
    try {
        if (inviteDetailsJson) {
            inviteDetails = JSON.parse(inviteDetailsJson);
        }
    } catch (e) {
        // Do nothing
    }
    User.getById(userToken.id).then((user) => {
        // Verify
        teamController.getInviteTokenFromUrlParams(inviteDetails.teamId, inviteDetails.inviterId, inviteDetails.inviteToken, true).then(([team, inviteLinkDetails]) => {
            user.addTeam(team, {
                id: inviteDetails.teamId,
                role: 'user'
            }).then((user) => {
                saveAndSendUser(user, res);
            }).catch((reason) => {
                console.error('error in save user for invite token google callback')
            });
        })
            .catch((reason) => {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('in login user accessing team invite');
            })
    }).catch(Config.HandleServerSideError);
}