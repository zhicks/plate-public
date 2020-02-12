import {Resource} from "../resources/resource-service";
import {Config} from "../config/config-service";
import {IUser, User} from "../models/users";


import * as Q from "q";

export abstract class BaseController {

    sendUnknownError(res) {
        res.status(400).json({
            message: Resource.Translatable.ERROR_Unknown
        });
    }
    /**
     * Verifies that the request has a user token, the user token has an email, and
     * the user exists. Returns a promise with the user if all is well.
     * @param req
     * @param res
     * @param errorTitle
     * @returns {Promise<boolean>}
     */
    verifyUserLoggedIn(req, res, errorTitle): Q.Promise<IUser> {
        let deferred = Q.defer<IUser>();
        const body = req.body;
        const userToken = req.userToken;
        if (!userToken) {
            res.status(400).json({
                message: Resource.Translatable.ERROR_Unknown
            });
            const reason = `No user token in ${errorTitle}`;
            Config.HandleServerSideError(reason);
            deferred.reject(reason);
        } else {
            const id = userToken.id;
            if (!id) {
                res.status(400).json({
                    message: Resource.Translatable.ERROR_Unknown
                });
                const reason = `No id in ${errorTitle}`;
                Config.HandleServerSideError(reason);
                deferred.reject(reason);
            } else {
                User.getById(id).then((user) => {
                    if (!user) {
                        res.status(400).json({
                            message: Resource.Translatable.ERROR_Unknown
                        });
                        const reason = `No user exists in ${errorTitle}`;
                        Config.HandleServerSideError(reason);
                        deferred.reject(reason);
                    } else {
                        deferred.resolve(user);
                    }
                }).catch(Config.HandleServerSideError);
            }
        }
        return deferred.promise;
    }

    /**
     * Verifies that the logged in user matches the user ID in the URL request
     * for example - /users/:userId/plates
     * @param user
     * @param userId
     */
    userIdMatchesRequestId(user: IUser, userId: string): boolean {
        return user.id === userId;
    }

}