import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import {AuthHttp} from "angular2-jwt";
import {ClientTeamInvitation, ClientTeam, UIClientTeam, TeamsService, ClientUserAccountType} from "./teams.service";
import {PaymentInterval} from "../../+settings/business/settings-business.component";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {LoggedInUser} from "../../../../shared/scripts/auth.service";

export const ClientUserUploadSize = {
    Default: 20 * 1000 * 1000,
    Second: 200 * 1000 * 1000,
    Third: 300 * 1000 * 1000
}

export interface ClientExtraEmail {
    email: string,
    isPrimary: boolean
}

@Injectable()
export class UsersService {

    protected url = '/api/users';

    constructor(
        protected authHttp: AuthHttp
    ){
        ClientUtil.payment.setStripeKey();
    }

    upgradeToPlateBusiness(userId: string, paymentInterval: PaymentInterval, expectedPriceInCents: number, team: UIClientTeam, stripeToken: any, promoCode: string) {
        const url = this.url + '/' + userId + '/upgrade-to-business/';
        return this.authHttp.post(url, {
            paymentInterval: paymentInterval,
            expectedPriceInCents: expectedPriceInCents,
            team: team.model.id,
            stripeToken: stripeToken,
            promoCode: promoCode
        }).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    getMaxUploadSize(user: LoggedInUser, team: UIClientTeam) {
        if (team && team.isPlateBusiness) {
            return ClientUserUploadSize.Third;
        }
        if (user.accountType === ClientUserAccountType.Gold) {
            return ClientUserUploadSize.Second;
        }
        return ClientUserUploadSize.Default;
    }

    getTeamInvitations(): Observable<ClientTeamInvitation[]> {
        const url = this.url + '/invitations/';
        return this.authHttp.get(url).map((res) => {
            if (res) {
                return res.json();
            }
            return null;
        });
    }

    getExtraEmails(userId: string): Observable<ClientExtraEmail[]> {
        const url = this.url + '/' + userId + '/emails';
        return this.authHttp.get(url).map((res) => {
            if (res) {
                let extraEmails: ClientExtraEmail[] = res.json();
                return extraEmails;
            }
            return null;
        });
    }

    declineTeamInvitation(invitation: ClientTeamInvitation): Observable<any> {
        const url = this.url + '/invitations/' + invitation.teamId;
        return this.authHttp.delete(url).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    acceptTeamInvitation(invitation: ClientTeamInvitation, teamsService: TeamsService): Observable<UIClientTeam> {
        const url = this.url + '/invitations/' + invitation.teamId;
        return this.authHttp.put(url, '').map((res) => {
            if (res) {
                let clientTeam: ClientTeam = res.json();
                return new UIClientTeam(clientTeam, teamsService);
            }
            return null;
        });
    }

    updateName(user: LoggedInUser, name: string): Observable<string> {
        const url = this.url + '/' + user.id;
        return this.authHttp.put(url, <any>{name: name}).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    addEmail(user: LoggedInUser, email: string): Observable<string> {
        const url = this.url + '/' + user.id + '/emails';
        return this.authHttp.post(url, <any>{email: email}).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    removeEmail(user: LoggedInUser, email: string): Observable<string> {
        const url = this.url + '/' + user.id + '/emails/remove';
        return this.authHttp.post(url, <any>{email: email}).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    cancelPlateBusiness(user: LoggedInUser, team: UIClientTeam): Observable<string> {
        const url = this.url + '/' + user.id + '/plate-business/cancel';
        return this.authHttp.post(url, <any>{team: team.model.id}).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    /**
     * If feedback is null, it is just an acknowledge.
     * @param feedback
     * @returns {any}
     */
    sendFeedback(feedback?: { message: string, rating: number }): Observable<string> {
        const url = this.url + '/feedback';
        //noinspection TypeScriptUnresolvedFunction
        return this.authHttp.post(url, <any>feedback).map((res) => {
            if (res) {
                return res.text();
            }
            return null;
        });
    }

    getInitials(name: string) {
        return UsersService.getInitials(name);
    }

    static getInitials(name: string) {
        if (!name) {
            return '';
        }
        let tokens = name.split(' ');
        let name1 = tokens[0].substring(0, 1);
        let name2 = '';
        if (tokens.length > 1) {
            name2 = tokens[tokens.length -1].substring(0, 1);
        }
        return name1 + name2;
    }

}