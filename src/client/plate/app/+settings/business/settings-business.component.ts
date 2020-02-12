import {Component, ViewChild, ElementRef} from "@angular/core";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {TeamsService, UIClientTeam, ClientPlateBusinessPaymentDetails} from "../../shared/api/teams.service";
import {PlateSideBarService} from "../../+home/sidebar/sidebar.component";
import {Router} from "@angular/router";
import {ClientUtil} from "../../../../shared/scripts/util.service";
import {UsersService} from "../../shared/api/users.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {PlateToastService} from "../../../../shared/scripts/directives/plate-toast.component.service";

enum SignupState {
    Initial
}

export enum PaymentInterval {
    Monthly,
    Yearly
}

// Later this will go in its own service
enum ValidationState {
    Unchecked,
    Bad,
    Good
}

@Component({
    moduleId: module.id,
    templateUrl: '/ps/app/+settings/business/settings-business.component.html'
})
export class SettingsBusinessComponent {

    constants = {
        monthlyPricePerMonthCents: 1200,
        monthlyPricePerMonthCentsPROMO: 800,
        yearlyPricePerMonthCents: 800
    }

    @ViewChild('businessComponentWrapper')
    businessComponentWrapper: ElementRef;

    COMPONENT_ID = 'SettingsBusinessComponent';

    user: LoggedInUser;
    teams: UIClientTeam[] = [];
    selectedTeam: UIClientTeam;

    PaymentInterval = PaymentInterval;
    ValidationState = ValidationState;

    hasPlateBusinessTeam = false;

    plateBusinessPaymentDetails: ClientPlateBusinessPaymentDetails = null;
    waiting = {
        forCancelOperation: false
    }
    cancelErrorStatus = '';
    upgradeThanksMessage = '';

    payment = {
        promoCodeApplied: false,
        validateCheckTimeout: null,
        totalTaxCents: 0,
        totalCentsBeforeTax: 0,
        totalCents: 0,
        paymentInterval: PaymentInterval.Yearly,
        validated: false,
        didSubmitAndWaitingForResponse: false,
        errorMessage: '',
        applicableTaxRate: 0,//0.0925,
        // Later this validation logic will go in its own service
        validation: {
            checked: {
                cc: false,
                exp: false,
                zip: false,
                cvc: false,
                agreeToTerms: false
            },
            blurred: {
                cc: false,
                exp: false,
                zip: false,
                cvc: false
            },
            valid: {
                cc: ValidationState.Unchecked,
                exp: ValidationState.Unchecked,
                zip: ValidationState.Unchecked,
                cvc: ValidationState.Unchecked,
                agreeToTerms: ValidationState.Unchecked
            }
        },
        form: {
            cc: '',
            exp: '',
            cvc: '',
            zip: '',
            promoCode: '',
            agreeToTerms: false
        }
    }

    constructor(
        private teamsService: TeamsService,
        private plateSideBarService: PlateSideBarService,
        private router: Router,
        private usersService: UsersService,
        private plateErrorHandler: PlateErrorHandlerService,
        private plateAuthService: PlateAuthService,
        private plateToastService: PlateToastService
    ) {}

    ngOnInit() {
        this.user = this.plateAuthService.getUserInfo();
        this.teams = this.teamsService.cache;
        this.plateSideBarService.registerForSideBarReady(this);
        Analytics.default('Settings Business Page Viewed', 'ngOnInit()');

        if (this.plateSideBarService._ready) {
            this.selectPlateBusinessTeamOnLoadIfExists();
        }
    }

    ngOnDestroy() {
        this.plateSideBarService.unregisterForSideBarReady(this);
    }

    onSideBarReadyEvent(ready: boolean) {
        if (ready) {
            this.selectPlateBusinessTeamOnLoadIfExists();
        }
    }

    // ------------------------------------------------------------------- Lifecycle

    private selectTeam(team: UIClientTeam) {
        this.selectedTeam = team;
        this.updateTotal();
        if (this.selectedTeam.isPlateBusiness) {
            if (this.userIsPurchaserOfPlateBusinessTeam(this.selectedTeam)) {
                this.teamsService.getPurchaseDetailsForPlateBusiness(this.user, this.selectedTeam).subscribe((paymentDetails) => {
                    this.plateBusinessPaymentDetails = paymentDetails;
                }, err => this.plateErrorHandler.error(err, 'getPurchaseDetailsForPlateBusiness'));
            }
        }
    }

    private selectPlateBusinessTeamOnLoadIfExists() {
        if (!this.selectedTeam) {
            for (let team of this.teamsService.cache) {
                if (team.isPlateBusiness) {
                    this.hasPlateBusinessTeam = true;
                    this.selectTeam(team);
                    break;
                }
            }
        }
    }

    private updateTotal() {
        if (this.selectedTeam) {
            let value = 0;
            let numMembers = this.selectedTeam.sortedMembers.length;
            if (this.payment.paymentInterval === PaymentInterval.Monthly) {
                if (!this.payment.promoCodeApplied) {
                    value = this.constants.monthlyPricePerMonthCents * numMembers;
                } else {
                    value = this.constants.monthlyPricePerMonthCentsPROMO * numMembers;
                }
            } else if (this.payment.paymentInterval === PaymentInterval.Yearly) {
                value = this.constants.yearlyPricePerMonthCents * 12 * numMembers;
                this.payment.form.promoCode = '';
                this.payment.promoCodeApplied = false;
            }
            this.payment.totalCentsBeforeTax = value;
            this.payment.totalTaxCents = value*this.payment.applicableTaxRate;
            value = value + this.payment.totalTaxCents;
            this.payment.totalCents = value;
        }
    }

    private validate() {
        // Later this will go in its owner service
        clearTimeout(this.payment.validateCheckTimeout);
        this.payment.validateCheckTimeout = setTimeout(() => {
            if (this.payment.validation.checked.cc) {
                if (ClientUtil.payment.creditCardIsValid(this.payment.form.cc)) {
                    this.payment.validation.valid.cc = ValidationState.Good;
                } else {
                    if (this.payment.validation.blurred.cc) {
                        this.payment.validation.valid.cc = ValidationState.Bad;
                    }
                }
            }
            if (this.payment.validation.checked.exp) {
                if (ClientUtil.payment.expirationDateIsValid(this.payment.form.exp)) {
                    this.payment.validation.valid.exp = ValidationState.Good;
                } else {
                    if (this.payment.validation.blurred.exp) {
                        this.payment.validation.valid.exp = ValidationState.Bad;
                    }
                }
            }
            if (this.payment.validation.checked.cvc) {
                if (ClientUtil.payment.cvcIsValid(this.payment.form.cvc)) {
                    this.payment.validation.valid.cvc = ValidationState.Good;
                } else {
                    if (this.payment.validation.blurred.cvc) {
                        this.payment.validation.valid.cvc = ValidationState.Bad;
                    }
                }
            }
            if (this.payment.validation.checked.zip) {
                if (ClientUtil.payment.zipIsValid(this.payment.form.zip)) {
                    this.payment.validation.valid.zip = ValidationState.Good;
                } else {
                    if (this.payment.validation.blurred.zip) {
                        this.payment.validation.valid.zip = ValidationState.Bad;
                    }
                }
            }
            if (this.payment.validation.checked.agreeToTerms) {
                if (this.payment.form.agreeToTerms) {
                    this.payment.validation.valid.agreeToTerms = ValidationState.Good;
                } else {
                    this.payment.validation.valid.agreeToTerms = ValidationState.Bad;
                }
            }
            let validated =
                this.payment.validation.valid.cc === ValidationState.Good &&
                this.payment.validation.valid.exp === ValidationState.Good &&
                this.payment.validation.valid.cvc === ValidationState.Good &&
                this.payment.validation.valid.zip === ValidationState.Good &&
                this.payment.validation.valid.agreeToTerms === ValidationState.Good;

            this.payment.validated = validated;
        }, 100);
    }

    // ------------------------------------------------------------------- UI Events

    cancelPlateBusinessClicked(team: UIClientTeam) {
        if (!this.waiting.forCancelOperation) {
            this.waiting.forCancelOperation = true;
            this.usersService.cancelPlateBusiness(this.user, team).subscribe((status) => {
                team.removePlateBusinessStatus();
                this.waiting.forCancelOperation = false;
                this.cancelErrorStatus = '';
            }, err => {
                this.cancelErrorStatus = `There was an error cancelling your subscription. Don't worry - you won't be liable for future charges. Please email hello@plate.work to help us get it sorted out.`
            });
        }
    }

    createAnotherTeamClicked() {
        this.router.navigate(['/settings/team']);
    }

    teamClicked(team: UIClientTeam) {
        this.selectTeam(team);
    }

    radioClicked(paymentInterval: PaymentInterval) {
        let selector = '';
        switch (paymentInterval) {
            case PaymentInterval.Monthly:
                selector = '#payment-interval-monthly-radio';
                break;
            case PaymentInterval.Yearly:
                selector = '#payment-interval-yearly-radio';
                break;
        }
        $(this.businessComponentWrapper.nativeElement).find(selector).prop('checked', true);
        this.payment.paymentInterval = paymentInterval;
        this.updateTotal();
    }

    submitPaymentClicked() {
        if (this.payment.validated && !this.payment.didSubmitAndWaitingForResponse) {
            this.payment.didSubmitAndWaitingForResponse = true;
            this.payment.errorMessage = '';
            let expTokens = this.payment.form.exp.split('/');
            let expMonth = expTokens[0];
            let expYear = expTokens[1];
            let stripeTokenDetails = {
                number: this.payment.form.cc,
                cvc: this.payment.form.cvc,
                exp_month: expMonth,
                exp_year: expYear,
                address_zip: this.payment.form.zip
            }
            ClientUtil.payment.createStripeToken(stripeTokenDetails, (status, response) => {
                if (response.error) {
                    this.payment.errorMessage = response.error.message;
                    this.payment.didSubmitAndWaitingForResponse = false;
                } else {
                    let token = response.id;
                    this.usersService.upgradeToPlateBusiness(this.user.id, this.payment.paymentInterval, this.payment.totalCents, this.selectedTeam, token, this.payment.form.promoCode).subscribe((status) => {
                        this.teamsService.getByIdAndUpdateCache(this.selectedTeam).subscribe((selectedTeam) => {
                            this.selectedTeam = selectedTeam;
                            this.upgradeThanksMessage = `You're awesome! Thanks for upgrading to Plate Business.`;
                            this.selectedTeam.updateIsPlateBusiness();
                            this.teamsService.getPurchaseDetailsForPlateBusiness(this.user, this.selectedTeam).subscribe((paymentDetails) => {
                                this.plateBusinessPaymentDetails = paymentDetails;
                            }, err => this.plateErrorHandler.error(err, 'getPurchaseDetailsForPlateBusiness'));
                        }, err => this.plateErrorHandler.error(err, 'teamRefresh'));
                    }, err => this.plateErrorHandler.error(err, 'upgrade to plate business'));
                }
            })
        }
    }

    // ------------------------------------------------------------------- Change events
    applyPromoCodeClicked() {
        if (this.payment.form.promoCode && this.payment.form.promoCode.toLowerCase() === '310nutrition') {
            if (this.payment.paymentInterval !== PaymentInterval.Monthly) {
                this.plateToastService.toast({
                    title: 'Monthly promo code',
                    message: 'That promo code only works for monthly payment!'
                })
            } else {
                this.plateToastService.toast({
                    title: 'Promo code applied!',
                    message: 'Awesome!'
                })
                this.payment.promoCodeApplied = true;
                this.updateTotal();
            }
        } else {
            this.plateToastService.toast({
                title: 'Promo code not valid',
                message: 'Sorry, that promo code is not valid'
            })
        }
    }

    // Later this will go in its own service
    ccKeyup() {
        this.payment.validation.checked.cc = true;
        this.validate();
    }
    cvcKeyup() {
        this.payment.validation.checked.cvc = true;
        this.validate();
    }
    expKeyup() {
        this.payment.validation.checked.exp = true;
        this.validate();
    }
    zipKeyup() {
        this.payment.validation.checked.zip = true;
        this.validate();
    }
    ccBlur() {
        this.payment.validation.blurred.cc = true;
        this.validate();
    }
    cvcBlur() {
        this.payment.validation.blurred.cvc = true;
        this.validate();
    }
    expBlur() {
        this.payment.validation.blurred.exp = true;
        this.validate();
    }
    zipBlur() {
        this.payment.validation.blurred.zip = true;
        this.validate();
    }

    agreeToTermsClicked() {
        this.payment.validation.checked.agreeToTerms = true;
        this.validate();
    }

    // ------------------------------------------------------------------- UI State (not payment)

    userIsPurchaserOfPlateBusinessTeam(team: UIClientTeam) {
        return this.user.id === team.model.plateBusiness.purchaser;
    }

}
