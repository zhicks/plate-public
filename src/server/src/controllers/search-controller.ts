import {BaseController} from "./base-controller";
import {IUser} from "../models/users";
import {Config} from "../config/config-service";
import {PlateItem, SimplePlateSearchResultsWithSize} from "../models/plate-item";
import {Resource} from "../resources/resource-service";
import {Request} from 'express';

class SearchController extends BaseController {

    search(req: Request, res) {
        super.verifyUserLoggedIn(req, res, 'Search query').then((user: IUser) => {
            const searchQuery = req.query.query;
            const maxResults = req.query.maxResults;

            PlateItem.search(user, searchQuery, maxResults).then((plateItemsSearchResult) => {
                let send: SimplePlateSearchResultsWithSize = {
                    results: [],
                    resultSizeEstimate: 0
                };
                if (plateItemsSearchResult && plateItemsSearchResult.results) {
                    for (let plateItem of plateItemsSearchResult.results) {
                        send.results.push(plateItem.simple());
                    }
                    send.resultSizeEstimate = plateItemsSearchResult.resultSizeEstimate || 0;
                }
                res.send(send);
            }).catch((reason) => {
                res.status(400).send({
                    message: Resource.Translatable.ERROR_Unknown
                });
                Config.HandleServerSideError('unknown error in search - query ' + searchQuery);
            })
        })
            .catch(reason => Config.HandleServerSideError(reason))
    }

}

export const searchController = new SearchController();