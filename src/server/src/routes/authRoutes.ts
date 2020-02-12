import * as express from "express";
import * as authController from "../controllers/auth/auth-controller";
import { teamController, InviteLinkDetails } from '../controllers/teams-controller';

const app = express();

export function baseAuthRoutes() {
    const router = express.Router();

    router.get('/login', (req, res) => {
        res.render('plain-login', {
            initialTitle: 'Plate.Work - Login'
        });
    });
    // Invite token
    router.get('/login/:teamId/:inviterId/:token', (req, res) => {
        //teamId: string, inviterId: string, token: string
        const teamId = req.params.teamId;
        const inviterId = req.params.inviterId;
        const token = req.params.token;
        teamController.getInviteTokenFromUrlParams(teamId, inviterId, token).then(([team, details]) => {
            (<any>details).initialTitle = 'Plate.Work - Login';
            res.render('plain-login', details);
        })
        .catch((reason) => {
            res.redirect('/login');
        });
    });

    router.get('/register', (req, res) => {
        res.render('plain-register', {
            initialTitle: 'Plate.Work - Register'
        });
    });

    router.get('/teaminvite/:teamId/:inviterId/:token', (req, res) => {
        const teamId = req.params.teamId;
        const inviterId = req.params.inviterId;
        const token = req.params.token;
        teamController.getInviteTokenFromUrlParams(teamId, inviterId, token).then(([team, details]) => {
            (<any>details).initialTitle = 'Plate.Work - Register';
            res.render('plain-register', details);
        })
        .catch((reason) => {
            res.redirect('/register');
        });
    });

    router.get('/logout', (req, res) => {
        res.render('logout');
    });

    return router;
}

export function auth(authenticate: any) {
    const router = express.Router();

    // Standard, Plate provided login / out routes
    router.post('/login', authController.login);
    router.post('/register', authController.register);
    router.post('/logout', authController.logout);
    router.post('/refresh', authenticate, authController.refresh);

    // These are authentication login routes
    router.get('/google', authController.google);
    router.get('/googlecallback', authController.googleCallback, authController.afterGoogleCallback);
    // Used for google callback since we can't attach on the req
    // If invite_details are in local storage, this gets called
    router.post('/teaminvite', authenticate, authController.teamInvitePost);

    router.get('/gmailcallback', authController.gmailCallback);
    router.get('/slackcallback', authController.slackcallback);

    router.get('/didauth', (req, res) => {
        res.render('close-callback', { });
    });

    // Click on auth Slack / Google and it
    // This is complicated but paradoxically seems like the easiest way to do it
    // User clicks on Auth Slack
    // window.open(vv one these urls vv)
    // that window makes an authenticated call to /auth/:userId/connectedapps/:connectedAppId/slackauth
    // to get the url, and that sets the temporary token
    // it returns the url and the page redirects
    // it finally lands on /didauth which closes the window
    router.get('/users/:userId/connectedapps/:connectedAppId/slackauth', (req, res) => {
        const userId = req.params.userId;
        const connectedAppId = req.params.connectedAppId;
        res.render('auth-get-url-then-redirect', {
            url: `/api/users/${userId}/connectedapps/${connectedAppId}/slackauth`
        });
    });
    router.get('/users/:userId/connectedapps/:connectedAppId/gmailauth', (req, res) => {
        const userId = req.params.userId;
        const connectedAppId = req.params.connectedAppId;
        res.render('auth-get-url-then-redirect', {
            url: `/api/users/${userId}/connectedapps/${connectedAppId}/gmailauth`
        });
    });

    return router;
}

