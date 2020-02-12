import { Component } from '@angular/core';
import {UsersService, ClientExtraEmail} from "../../shared/api/users.service";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {ClientUtil} from "../../../../shared/scripts/util.service";

@Component({
    moduleId: module.id,
    templateUrl: '/ps/app/+settings/profile/settings-profile.component.html'
})
export class SettingsProfileComponent {

    inputTimeout = {
        timeout: null,
        isWaiting: false
    }

    profile: LoggedInUser;
    editingName = false;
    editingNameText = '';
    extraEmails: ClientExtraEmail[] = [];

    addingExtraEmail = false;
    addingExtraEmailContent = '';
    addingExtraEmailErrorStatus = '';

    constructor(
        private plateAuthService: PlateAuthService,
        private usersService: UsersService,
        private plateErrorHandler: PlateErrorHandlerService
    ) {}

    ngOnInit() {
        this.profile = this.plateAuthService.getUserInfo();
        Analytics.default('Profile Page Viewed', 'ngOnInit()');

        this.usersService.getExtraEmails(this.profile.id).subscribe((extraEmails) => {
        	this.extraEmails = extraEmails;
        }, err => this.plateErrorHandler.error(err, 'get extra emails for user'));
    }

    // ------------------------------------------------------------------- UI Events
    addEmailClicked() {
        if ((!this.profile.email && this.extraEmails.length > 2) || (this.profile.email && this.extraEmails.length > 1)) {
            this.addingExtraEmailErrorStatus = 'Sorry, you can only have three emails at this time.';
            this.addingExtraEmail = false;
            return;
        }
        this.addingExtraEmail = !this.addingExtraEmail;
    }

    private saveExtraEmail() {
        if (this.inputTimeout.isWaiting) {
            return;
        }
        if ((!this.profile.email && this.extraEmails.length > 2) || (this.profile.email && this.extraEmails.length > 1)) {
            this.addingExtraEmailErrorStatus = 'Sorry, you can only have three emails at this time.';
            return;
        }
        const haveAlreadyAddedThisEmailMessage = 'You have already added this email.';
        if (this.profile.email === this.addingExtraEmailContent) {
            this.addingExtraEmailErrorStatus = haveAlreadyAddedThisEmailMessage;
            return;
        }
        for (let email of this.extraEmails) {
            if (email.email === this.addingExtraEmailContent) {
                this.addingExtraEmailErrorStatus = haveAlreadyAddedThisEmailMessage;
                return;
            }
        }
        if (!ClientUtil.emailIsValid(this.addingExtraEmailContent)) {
            this.addingExtraEmailErrorStatus = 'Please enter a valid email';
        } else {
            this.usersService.addEmail(this.profile, this.addingExtraEmailContent).subscribe((status) => {
                this.extraEmails.push({
                    email: this.addingExtraEmailContent,
                    isPrimary: false
                });
                this.addingExtraEmailContent = '';
                this.addingExtraEmail = false;
                this.addingExtraEmailErrorStatus = '';
            }, err => {
                this.addingExtraEmailErrorStatus = 'That email is already in use.';
            });
            clearTimeout(this.inputTimeout.timeout);
            this.inputTimeout.isWaiting = true;
            this.inputTimeout.timeout = setTimeout(() => {
                this.inputTimeout.isWaiting = false;
            }, 1000);
        }
    }
    saveExtraEmailClicked() {
        this.saveExtraEmail();
    }
    saveExtraEmailEnterPressed($event) {
        if ($event) {
            $event.preventDefault();
            this.saveExtraEmail();
        }
    }

    deleteExtraEmailClicked(email: string) {
        let emailText = email;
        if (this.profile.email === emailText) {
            this.profile.email = null;
        } else {
            for (let i = 0; i < this.extraEmails.length; i++) {
                let extraEmailIterate = this.extraEmails[i];
                if (extraEmailIterate.email === emailText) {
                    this.extraEmails.splice(i, 1);
                    break;
                }
            }
        }
        this.usersService.removeEmail(this.profile, emailText).subscribe((status) => {
            this.plateAuthService.refresh().subscribe((data) => {});
        }, err => this.plateErrorHandler.error(err, 'in delete extra email'));
    }

    editNameClicked() {
        this.editingName = true;
        this.editingNameText = this.profile.name;
    }

    saveEditNameClicked() {
        this.usersService.updateName(this.profile, this.editingNameText).subscribe((status) => {
            this.editingName = false;
            this.editingNameText = '';
            this.plateAuthService.refresh().subscribe((userInfo) => {
            	this.profile.name = userInfo.name;
            }, err => this.plateErrorHandler.error(err, 'in refresh save edit user'));
        }, err => this.plateErrorHandler.error(err, 'in save user name'));
    }

    cancelEditNameClicked() {
        this.editingName = false;
        this.editingNameText = '';
    }

}
