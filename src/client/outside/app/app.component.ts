import { Component, OnInit } from '@angular/core';
import { Http } from "@angular/http";
import { PlateAuthService } from "../../shared/scripts/auth.service";
import { AuthHttp } from 'angular2-jwt';

@Component({
    selector: 'plate-index-widget',

    // For now, this will just be a blank template
    template: ``
    // template: `
    //     <h2>{{ loginStatus }}</h2>
    //     <h4>{{ error }}</h4>
    // `
})
export class AppComponent implements OnInit {
    error: string = '';
    loginStatus: string = '';

    constructor(private http: Http, private plateAuthService: PlateAuthService, private authHttp: AuthHttp) {
    }

    ngOnInit() {
        this.updateLoginStatus();
    }

    private updateLoginStatus () {
        const user = this.plateAuthService.getUserInfo();
        if (user) {
            if (user) {
                this.loginStatus = 'logged in: ' + user.email + ', ' + user.name;
            } else {
                this.loginStatus = 'no provider';
            }
        } else {
            this.loginStatus = 'not logged in';
        }
    }

    logOut() {
        this.plateAuthService.logout().subscribe(
            (result) => {
                console.log(result);
                this.updateLoginStatus();
                // redirect here
            },
            (error) => {
                console.error(error);
            }
        )
    }

}