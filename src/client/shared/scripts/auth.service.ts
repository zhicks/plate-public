// Ref: https://auth0.com/blog/2016/05/31/cookies-vs-tokens-definitive-guide/

import {Injectable} from "@angular/core";
import {JwtHelper, tokenNotExpired, AuthHttp} from "angular2-jwt";
import {Http} from "@angular/http";
import {Observable} from "rxjs/Observable";
import {ClientUserAccountType} from "../../plate/app/shared/api/teams.service";

export interface ClientUserTeamReference {
    id: string,
    role: 'admin' | 'user'
}
export interface LoggedInUser {
    id: string;
    name: string;
    email: string;
    teams: ClientUserTeamReference[];
    defaultTeam: string;
    requestFeedback: boolean;
    ug: number;
    accountType: ClientUserAccountType;
}

export interface LastLoggedInInfo {
    teamId: string;
}

@Injectable()
export class PlateAuthService {

    private Constants = {
        // TODO - This should be configured in bootstrap to make more generic
        // TODO - And remove the Plate stuff in general - PlateAuthService should sit on top of a generic auth service
        TOKEN_NAME: 'id_token',
        url: {
            LOGIN_URL: '/auth/login',
            LOGOUT_URL: '/auth/logout',
            REGISTER_URL: '/auth/register',
            REFRESH_URL: '/auth/refresh'
        }
    }
    private user: LoggedInUser;
    private jwtHelper: JwtHelper;
    private refreshListeners = [];

    constructor(
        private http: Http,
        private authHttp: AuthHttp
    ) {
        this.jwtHelper = new JwtHelper();
        this.setUserInfo();
        this.refresh().subscribe( (data) => { } );
    }

    listenForUserRefresh(x: any) {
        this.refreshListeners.push(x);
    }

    getUserInfo() {
        return this.user;
    }

    redirectToHome() {
        window.location.replace('/');
        // TODO: Should subscribe like this
        // this.sub = this.authService.subscribe((val) => {
        //     if (!val.authenticated) {
        //         this.location.replaceState('/'); // clears browser history so they can't navigate with back button
        //         this.router.navigate(['LoggedoutPage']); // tells them they've been logged out (somehow)
        //     }
        // });
    }

    public getToken() {
        return localStorage.getItem(this.Constants.TOKEN_NAME);
    }

    public getAuthorizationHeader() {
        return `Bearer ${this.getToken()}`;
    }

    private setUserInfo() {
        const token = this.getToken();
        if (token && tokenNotExpired()) {
            let userObj = this.jwtHelper.decodeToken(token);
            this.user = userObj;
        }
    }

    refresh(): Observable<any> {
        return new Observable<any>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.authHttp.post(this.Constants.url.REFRESH_URL, '').map((res) => {
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe(
                (data) => {
                    localStorage.setItem(this.Constants.TOKEN_NAME, data.token);
                    this.setUserInfo();
                    //console.log(this.user);
                    observer.next(this.user);
                    for (let listener of this.refreshListeners) {
                        listener.onUserRefresh();
                    }
                    observer.complete();
                },
                (error) => {
                    console.error(error);
                    localStorage.removeItem(this.Constants.TOKEN_NAME);
                    this.user = null;
                    if (window.location.pathname.indexOf('/p/') > -1) {
                        this.redirectToHome();
                    }
                });
        });
    }

    login(email: string, password: string): Observable<any> {
        return new Observable<any>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.http.post(this.Constants.url.LOGIN_URL, {
                email: email,
                password: password
            }).map((res) => {
                console.debug(<any>res);
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe(
                (data) => {
                    console.debug(data);
                    localStorage.setItem(this.Constants.TOKEN_NAME, data.token);
                    this.setUserInfo();
                    observer.next(this.user);
                    observer.complete();
                },
                (error) => {
                    console.error(error);
                    observer.error(error);
                    observer.complete();
                });
        });
    }

    logout(): Observable<any> {
        return new Observable<any>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.http.post(this.Constants.url.LOGOUT_URL, {}).map((res) => {
                console.debug(<any>res);
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe(
                (data) => {
                    console.debug(data);
                    localStorage.removeItem(this.Constants.TOKEN_NAME);
                    this.user = null;
                    observer.next(true);
                    observer.complete();
                },
                (error) => {
                    console.error(error);
                    observer.next(false);
                    observer.complete();
                });
        });
    }

    register(email: string, password: string): Observable<any> {
        return new Observable<any>((observer) => {
            //noinspection TypeScriptUnresolvedFunction
            this.http.post(this.Constants.url.REGISTER_URL, {
                email: email,
                password: password
            }).map((res) => {
                console.debug(<any>res);
                if (res) {
                    return res.json();
                }
                return null;
            }).subscribe(
                (data) => {
                    console.debug(data);
                    localStorage.setItem(this.Constants.TOKEN_NAME, data.token);
                    this.setUserInfo();
                    observer.next(this.user);
                    observer.complete();
                },
                (error) => {
                    console.error(error);
                    observer.error(error);
                    observer.complete();
                });
        });

    }

    // ---------------------------------------------------------- Utility
    clearArray(arr: any[]) {
        if (arr) {
            while (arr.length)
                arr.pop();
        }
    }

}