import * as passport from "passport";

import * as local from './local-strategy';
import * as google from './google-strategy';

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

passport.use(local.strategy);
passport.use(google.strategy);