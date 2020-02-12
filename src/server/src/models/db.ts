import * as mongoose from "mongoose";

import { Config } from '../config/config-service';

let dbURI = Config.Keys.DB_URI;
let dbUser = Config.Keys.DB_USER;
let dbPass = Config.Keys.DB_PASS;
mongoose.connect(dbURI, { 
    user: dbUser,
    pass: dbPass
});

mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to ' + dbURI);
});
mongoose.connection.on('error', (err) => {
    console.log('Mongoose connection error: ' + err);
});
mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

// Bring in models
require('./notifications');
require('./teams');
require('./users');
