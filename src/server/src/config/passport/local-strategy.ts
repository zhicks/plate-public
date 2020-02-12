import * as passportLocal from "passport-local";
let LocalStrategy = passportLocal.Strategy;
import * as mongoose from "mongoose";

import { IUser, IUserStatic } from '../../models/users';
import {Config} from "../config-service";
import {Resource} from "../../resources/resource-service";
let User = <IUserStatic> mongoose.model('User');

export const strategy = new LocalStrategy({
        usernameField: 'email'
    },
    (email, password, done) => {
        User.findByEmail(email)
            .then((user) => {
                if (!user) {
                    return done(Resource.Translatable.ERROR_UserNotFound);
                }
                // If the user has a password, go for it
                // But if not, tell the user to login via their provider
                if (user.hasPassword()) {
                    if (!user.isPasswordValid(password)) {
                        return done(Resource.Translatable.ERROR_PasswordWrong);
                    } else {
                        return done(null, user);
                    }
                } else {
                    const providerName = user.getAuthProviderType();
                    if (providerName) {
                        return done(Resource.Translatable.ERROR_ShouldLogInUsingProvider);
                    } else {
                        Config.HandleServerSideError('in local strategy');
                        return done(Resource.Translatable.ERROR_Unknown);
                    }
                }

            })
            .catch(reason => Config.HandleServerSideError(reason));
    });