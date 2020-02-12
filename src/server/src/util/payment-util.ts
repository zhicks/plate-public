import {Config} from "../config/config-service";
const stripe = require('stripe')(Config.Keys.STRIPE_SECRET_KEY);
import * as Q from "q";
import {IUser} from "../models/users";
import {ITeam} from "../models/teams";
import {PlateMailer} from "./plate-mailer";
const uuid = require('node-uuid');

// This goes in the database for teams.
// Do not change present values, but can add
export enum ServerPaymentInterval {
    Monthly,
    Yearly
}

export enum PaymentStatus {
    Active,
    NonActive,
    Deliquent
}

export interface IStripeCustomerDetails {
    customerId: string
    customerEmail: string
    last4: string,
    subscriptionId: string,
    quantity: number,
    taxPercent: number,
    currentPeriodStart: number,
    currentPeriodEnd: number,
    planAmount: number
}

export interface IStripeUpdatePlanDetails {
    quantity: number;
    planAmount: number;
}

class _PaymentUtil {

    static constants = {
        planIds: {
            BUSINESS_MONTHLY_PROMO_OCT2016: 'platebusinesspromooct2016',
            BUSINESS_MONTHLY_OCT2016: 'p004',
            BUSINESS_YEARLY_OCT2016: 'p005'
        }
    }

    static subscribeTeamForPlateBusiness(user: IUser, paymentInterval: ServerPaymentInterval, team: ITeam, stripeToken: any, promoCode: string): Q.Promise<IStripeCustomerDetails> {
        let deferred = Q.defer<IStripeCustomerDetails>();
        let primaryEmail = user.getPrimaryEmail();
        let planId = PaymentUtil.constants.planIds.BUSINESS_MONTHLY_OCT2016;
        if (paymentInterval === ServerPaymentInterval.Yearly) {
            planId = PaymentUtil.constants.planIds.BUSINESS_YEARLY_OCT2016;
        }

        // Promo code. Overrides payment interval
        if (promoCode && promoCode.toLowerCase() === '310nutrition') {
            planId = PaymentUtil.constants.planIds.BUSINESS_MONTHLY_PROMO_OCT2016;
        }

        team.getMembers().then((members) => {
            let numMembers = members.length;
            // Create a customer regardless
            stripe.customers.create(
                {
                    email: primaryEmail,
                    description: user.id,
                    source: stripeToken
                },
                function(err, customer) {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        stripe.subscriptions.create({
                            customer: customer.id,
                            plan: planId,
                            quantity: numMembers,
                            tax_percent: 0//9.25
                        }, (err, subscription: Stripe.Subscription) => {
                            let last4 = customer.sources.data[0].last4;
                            deferred.resolve({
                                customerId: customer.id,
                                customerEmail: customer.email,
                                last4: last4,
                                subscriptionId: subscription.id,
                                quantity: subscription.quantity,
                                taxPercent: subscription.tax_percent,
                                currentPeriodStart: subscription.current_period_start,
                                currentPeriodEnd: subscription.current_period_end,
                                planAmount: subscription.plan.amount
                            });
                        });
                    }
                }
            );

        }).catch((reason) => {
            deferred.reject(reason);
        });

        return deferred.promise;
    }

    static changePlanForPlateBusinessMemberChanges(team: ITeam, numMembers: number): Q.Promise<IStripeUpdatePlanDetails> {
        let deferred = Q.defer<IStripeUpdatePlanDetails>();
        if (!(team.plateBusiness && team.plateBusiness._customerId)) {
            deferred.reject('Team does not seem to be Plate Business');
            console.error('Team does not seem to be Plate Business')
        } else {
            stripe.subscriptions.update(team.plateBusiness._subscription,
                {
                    quantity: numMembers
                },
                (err, subscription) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        let quantity = subscription.quantity;
                        deferred.resolve({
                            quantity: quantity,
                            planAmount: subscription.plan.amount
                        });
                        PlateMailer.sendReport('A Plate Business team has updated their user count', team.name + ' users: ' + quantity);
                    }
                });
        }
        return deferred.promise;
    }

    static cancelPlateBusiness(team: ITeam): Q.Promise<boolean> {
        let deferred = Q.defer<boolean>();
        if (!(team.plateBusiness && team.plateBusiness._customerId)) {
            deferred.reject('Team does not seem to be Plate Business');
            console.error('Team does not seem to be Plate Business')
        } else {
            stripe.subscriptions.del(team.plateBusiness._subscription,
                {
                    at_period_end: true
                },
                (err, subscription) => {
                    if (err) {
                        deferred.reject(err);
                    } else {
                        deferred.resolve(true);
                        PlateMailer.sendReport('A Plate Business team has cancelled Plate Business', team.name);
                    }
                });
        }
        return deferred.promise;
    }


}

// There does not seem to be a decent Stripe typings library.
namespace Stripe {

    export interface Plan {
        "id": string,
        "object": 'plan',
        "amount": number,
        "created": number,
        "currency": string,
        "interval": string,
        "interval_count": number,
        "livemode": boolean,
        "metadata": any,
        "name": string,
        "statement_descriptor": string,
        "trial_period_days": number
    }

    export interface Subscription {
        "id": string,
        "object": 'subscription',
        "application_fee_percent": number,
        "cancel_at_period_end": boolean,
        "canceled_at": number,
        "created": number,
        "current_period_end": number,
        "current_period_start": number,
        "customer": string,
        "discount": number,
        "ended_at": number,
        "livemode": boolean,
        "metadata": any,
        "plan": {
            "id": string,
            "object": "plan",
            "amount": number,
            "created": number,
            "currency": string,
            "interval": string,
            "interval_count": number,
            "livemode": boolean,
            "metadata": any,
            "name": string,
            "statement_descriptor": string,
            "trial_period_days": number
        },
        "quantity": number,
        "start": number,
        "status": string, // 'canceled'
        "tax_percent": number,
        "trial_end": number,
        "trial_start": number
    }

}

export const PaymentUtil = _PaymentUtil;