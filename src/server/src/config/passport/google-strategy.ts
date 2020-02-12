import * as mongoose from "mongoose";
let passportGoogle = require('passport-google-oauth20');
let GoogleStrategy = <any>passportGoogle.Strategy;
import { Config } from '../../config/config-service';

import {IUser, IUserStatic, IExtraProviderDetails} from '../../models/users';
import {Resource} from "../../resources/resource-service";
const User: IUserStatic = <IUserStatic>mongoose.model('User');

interface IGoogleAuthTokenPhoto {
    value: string; // url
}
interface IGoogleAuthTokenEmail {
    type: string; // 'acount'
    value: string; // soandso@gmail.com
}
interface IGoogleAuthTokenResult {
    displayName: string;
    gender: string;
    id: string;
    name: {
        familyName: string;
        givenName: string;
    }
    emails: IGoogleAuthTokenEmail[];
    photos: IGoogleAuthTokenPhoto[];
    provider: string; // "google"
    _json: { // json result of raw contents
        circledByCount: number;
        displayName: string;
        etag: string;
        gender; string;
        id: string;
        image: {
            isDefault: boolean;
            url: string; // same as first in photos array
        }
        isPlusUser: boolean;
        kind: string; // "plus#person"
        language: string; // "en"
        objectType: string; // "person"
        url: string; // google plus url
        verified: boolean;
    };
    _raw: string;
}

export const strategy = new GoogleStrategy({
        clientID: Config.Keys.Providers.Google.CLIENT_ID,
        clientSecret: Config.Keys.Providers.Google.CLIENT_SECRET,
        callbackURL: Config.Keys.Providers.Google.CALLBACK_URL
    }, (accessToken, refreshToken, profile: IGoogleAuthTokenResult, done: (err, user?, info?) => void) => {

        let userEmail: string;
        for (let email of profile.emails) {
            if (email.type === 'account') {
                userEmail = email.value;
                break;
            }
        }

        User.findByEmail(userEmail).then((user: IUser) => {
            // If the email does not exist, create the account with google provided ID and email.
            if (!user) {
                User.newUser(profile.displayName, userEmail, null, {id: profile.id}).then((newUser) => {
                    done(null, newUser);
                });
            } else {
                // If the email exists, they may have signed up with email or a provider.
                const provider = user.hasMainGoogleProviderForId(profile.id);
                if (!provider) {
                    // The user may have attached an extra google account.
                    const hasExtraGoogleProvider = user.hasExtraProviderForId(Config.Keys.Providers.Google.NAME, profile.id);
                    // If the user has this extra provider, just login.
                    if (hasExtraGoogleProvider) {
                        return done(null, user);
                    } else {
                        // If the user does not have the extra provider, we need to either attach a main provider,
                        // or attach an extra provider.
                        if (user.authProviderGoogle.id) {
                            // The user has a main provider, we need to attach an extra one.
                            let extraProviderDetails: IExtraProviderDetails = {
                                provider: Config.Keys.Providers.Google.NAME,
                                providerId: profile.id
                            }
                            user.addExtraProvider(extraProviderDetails).then((user) => {
                                return done(null, user);
                            }).catch((reason) => {
                                done(Resource.Translatable.ERROR_Unknown);
                                return;
                            });
                        } else {
                            // The user does not have a main provider, attach one.
                            user.addAuthProviderGoogle(profile.id).then((user) => {
                                return done(null, user);
                            }).catch((reason) => {
                                done(Resource.Translatable.ERROR_Unknown);
                                return;
                            })
                        }
                    }
                } else {
                    // If it's already there, just login.
                    return done(null, user);
                }
            }
        }).catch(reason => Config.HandleServerSideError(reason));
})