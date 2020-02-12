import * as express from "express";
import * as http from "http";
import * as path from "path";
import * as swig from "swig";
import * as expressJwt from "express-jwt";
import * as cors from "cors";
import * as passport from "passport";
import * as bodyParser from "body-parser";
import * as socketIo from 'socket.io';
import * as compression from 'compression';
const socketIoJwt = require('socketio-jwt');

import { Config } from './config/config-service';

require('./models/db');
require('./config/passport/passport');

import * as apiRoutes from './routes/apiRoutes';
import * as authRoutes from './routes/authRoutes';
import {socketController} from "./socket/socket-controller";
import {timeRunner} from "./util/time-runner";
import {hookRoutes} from "./routes/hookRoutes";
import {IUser, User} from "./models/users";
import {PlateMailer} from "./util/plate-mailer";
import {ConnectedApp} from "./models/connectedapps";
import {PlateItem} from "./models/plate-item";
import {Plate} from "./models/plates";

class PlateServer {

    private app: any; //express.Express;
    private server: http.Server;
    private socketIoServer: SocketIO.Server;
    private static Constants = {
        PORT: Config.Keys.NODE_PORT
    }

    constructor() {
        this.app = express();

        let authenticate = expressJwt({
            secret: Config.Keys.JWT_SECRET,
            userProperty: 'userToken'
        });

        this.app.use(cors());

        this.app.use(compression());

        this.app.use(passport.initialize());

        this.server = this.app.listen(PlateServer.Constants.PORT, () => {
            console.info('Plate Server started by ' + Config.DeployByUser);
            console.info('Listening on *:' + PlateServer.Constants.PORT);
        });

        this.setSocketServer();

        // We keep the view renderer, rather than sending a static file, to have a backup
        // in case we don't want to use angular and to make it easier to render server side 
        // parameters on the page - like environment variables        
        this.app.engine('html', swig.renderFile);
        this.app.set('view engine', 'html');
        swig.setDefaults({ cache: false });

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));

        this.app.set('views', path.join(__dirname, '/../../client/swig-views'));

        // Plate static
        this.app.use('/ps', express.static(__dirname + '/../../client/plate'));
        // Outside static
        this.app.use('/os', express.static(__dirname + '/../../client/outside'));
        // Shared static
        this.app.use('/shared', express.static(__dirname + '/../../client/shared'));
        this.app.use('/node_modules', express.static(__dirname + '/../node_modules'));

        this.setRoutes(authenticate);

        timeRunner.init();

        if (!Config.isProduction()) {
            // Development error handler
            let errorHandler: any = (err, req, res, next) => {
                res.status(err.status || 500);
                res.render('error', {
                    message: err.message,
                    error: err.stack.toString()
                });
            }
            this.app.use(errorHandler);
        } else {
            // Prod error handler
            let errorHandler: any = (err, req, res, next) => {
                res.status(err.status || 500);
                res.render('error', {
                    message: err.message,
                    error: {}
                });
            }
            this.app.use(errorHandler);
        }

    }

    private setSocketServer() {
        this.socketIoServer = socketIo(this.server);
        socketController.setSocketIoServer(this.socketIoServer);
        this.socketIoServer
            .on('connection', socketIoJwt.authorize({
                secret: Config.Keys.JWT_SECRET,
                timeout: 15000 // 15 seconds to send the authentication message
            }))
            .on('authenticated', (socket) => {
                socketController.newConnection(socket);
            });
    }

    private setRoutes(authenticate: any/*expressJwt.RequestHandler*/) {

        this.app.use('/', authRoutes.baseAuthRoutes());
        this.app.use('/', hookRoutes());
        this.app.use('/auth', authRoutes.auth(authenticate));

        this.app.use('/api', authenticate, apiRoutes.routes());

        // Plate routes
        this.app.get('/p', (req, res) => {
            res.render('plate-index', {
                initialTitle: 'Home - Plate.Work',
                STRIPE_PUBLISHABLE_KEY: Config.Keys.STRIPE_PUBLISHABLE_KEY
            });
        });
        this.app.get('/p/*', (req, res) => {
            res.render('plate-index', {
                initialTitle: 'Home - Plate.Work',
                STRIPE_PUBLISHABLE_KEY: Config.Keys.STRIPE_PUBLISHABLE_KEY
            });
        });

        // Outside routes
        this.app.get('/', (req, res) => {
            res.render('outside-index', {
                initialTitle: 'Plate: Be hungry for your day'
            });
        });
        this.app.get('/terms-of-service', (req, res) => {
            res.render('legal-terms', {
                initialTitle: 'Terms of Service | Plate'
            });
        });
        this.app.get('/privacy-policy', (req, res) => {
            res.render('legal-privacy', {
                initialTitle: 'Privacy Policy | Plate'
            });
        });
        this.app.get('/guide', (req, res) => {
            res.render('outside-plate-guide', {
                initialTitle: 'Plate Guide | Plate'
            });
        });
        this.app.get('/plate-api', (req, res) => {
            res.render('outside-plate-api', {
                initialTitle: 'Plate API | Plate'
            });
        });
        this.app.get('/changelog', (req, res) => {
            res.render('outside-changelog', {
                initialTitle: 'Plate Updates | Plate'
            });
        });

        // YC Demo
        this.app.get('/login-yc-demo-3c43d90a-3313', (req: express.Request, res) => {
            User.findByEmail('yc@plate.work').then((user) => {
                const token = user.generateJwt();
                // put the token details in local storage
                // in auth callback check for that
                // then send it and update the user that way
                res.render('auth-callback', {
                    token: token
                });

                PlateMailer.sendReport('YC at Plate.work has signed in', 'YC at Plate.work has signed in');
                setTimeout(() => {
                    // Send them an email 10 seconds after they sign in
                    PlateMailer.sendEmailGeneric('yc@plate.work', 'Thanks for signing in!', 'We really appreciate it! Feel free to ask us any questions.');
                }, 1000 * 10);
            }).catch((reason) => {
                console.error(reason);
            })
        });

    }
}

new PlateServer();