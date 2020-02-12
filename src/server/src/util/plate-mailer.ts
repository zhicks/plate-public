import * as Q from "q";
import {Config} from "../config/config-service";
import {LoggedInUserFeedback} from "../controllers/users-controller";
import {ITeam} from "../models/teams";
import {IUser} from "../models/users";
const sendgrid = require('sendgrid');
const plateSendgrid = sendgrid(Config.Keys.SENDGRID_API_KEY);

export interface InviteEmailOpts {
    email: string;
    team: ITeam;
    token: string;
    inviter: IUser;
}

export class PlateMailer {

    static userFeedback(userEmail: string, feedback: LoggedInUserFeedback): Q.Promise<number> {
        let deferred = Q.defer<number>();
        try {
            const helper = sendgrid.mail;
            const fromEmail = new helper.Email('hello@plate.work', 'Plate.Work');
            const toEmail = new helper.Email('hello@plate.work');
            const subject = 'Plate User Feedback: ' + feedback.message;
            const content = new helper.Content('text/plain', `
                    Plate User Feedback from ${userEmail}.\n\nRating: ${feedback.rating} stars.\n\nFeedback Content: ${feedback.message}
                `);
            const mail = new helper.Mail(fromEmail, subject, toEmail, content);
            const category = new helper.Category("user-feedback");
            mail.addCategory(category);
            const email = new helper.Email(Config.FeedbackNotificationEmail);
            mail.personalizations[0].addTo(email);

            const request = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: mail.toJSON()
            });

            plateSendgrid.API(request, function(error, response) {
                console.log('sendgrid status: ' + response.statusCode);
                console.info('sendgrid: sending feedback to hello@plate.work');

                const helper = sendgrid.mail;
                const fromEmail = new helper.Email('hello@plate.work', 'Plate Team');
                const toEmail = new helper.Email(userEmail);
                const subject = 'We got your message!';
                const content = new helper.Content('text/html', ' ');
                const mail = new helper.Mail(fromEmail, subject, toEmail, content);
                const category = new helper.Category("user-feedback-notice");
                mail.addCategory(category);

                mail.personalizations[0].addSubstitution(
                    new helper.Substitution('-userfeedbackmessage-', feedback.message));
                if (feedback.rating > 0) {
                    mail.personalizations[0].addSubstitution(
                        new helper.Substitution('-userfeedbackrating-', 'Rating: ' + feedback.rating.toString() + ' stars'));
                } else {
                    mail.personalizations[0].addSubstitution(
                        new helper.Substitution('-userfeedbackrating-', ' '));
                }
                mail.setTemplateId('8648c303-76fd-4c13-b1d3-b7e373d36154');

                const noticeRequest = sendgrid.emptyRequest({
                    method: 'POST',
                    path: '/v3/mail/send',
                    body: mail.toJSON()
                });
                plateSendgrid.API(noticeRequest, function(error, response) {
                    console.log('sendgrid status: ' + response.statusCode);
                    console.info('sendgrid: sending feedback notice to ' + userEmail);
                    console.log(response.body);
                });

                // Add contact to Sendgrid
                const contactRequest = sendgrid.emptyRequest({
                    method: 'POST',
                    path: '/v3/contactdb/recipients',
                    body: [
                        {
                            "email": userEmail
                        }
                    ]
                });
                plateSendgrid.API(contactRequest, function(error, response) {
                    // console.log(response.body);
                    // console.log(response.headers);
                    console.log('sendgrid status: ' + response.statusCode);
                    console.info('sendgrid: adding ' + userEmail + ' to contacts');
                    deferred.resolve(200);
                });
            });
        } catch (e) {
            deferred.reject(e);
        }

        return deferred.promise;
    }

    static sendInviteForTeam(opts: InviteEmailOpts) {
        // We can make the HTML with sendgrid I assume
        console.log('send email with this link');
        const token = opts.token;
        const teamId = opts.team.id;
        const inviterId = opts.inviter.id;
        let link = `https://www.plate.work/teaminvite/${teamId}/${inviterId}/${token}`;
        console.log(link);

        const helper = sendgrid.mail;
        const fromEmail = new helper.Email('hello@plate.work', 'Plate Team');
        const toEmail = new helper.Email(opts.email);
        const subject = opts.inviter.name + ' invited you to ' + opts.team.name + ' on Plate';
        const content = new helper.Content('text/html', ' ');
        const mail = new helper.Mail(fromEmail, subject, toEmail, content);
        const category = new helper.Category("team-invite");
        mail.addCategory(category);

        mail.personalizations[0].addSubstitution(
            new helper.Substitution('-teamname-', opts.team.name));
        mail.personalizations[0].addSubstitution(
            new helper.Substitution('-invitername-', opts.inviter.name));
        mail.personalizations[0].addSubstitution(
            new helper.Substitution('-link-', link));
        mail.setTemplateId('92982225-f3d6-41bb-9357-72f4a0590d19');

        const request = sendgrid.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: mail.toJSON()
        });

        plateSendgrid.API(request, function(error, response) {
            console.log('sendgrid status: ' + response.statusCode);
            console.info('sendgrid: sending team invite email');
            // console.log(response.body);
            // console.log(response.headers);

            // Send notification to hello@plate.work
            const helper = sendgrid.mail;
            const fromEmail = new helper.Email('hello@plate.work', 'Plate.Work');
            const toEmail = new helper.Email('hello@plate.work');
            const subject = 'Plate Team Invite: ' + opts.team.name;
            const content = new helper.Content('text/plain', `Plate Team Invite: ${opts.team.name}
            ${opts.inviter.email} invited ${opts.email}
            Great job!
                `);
            const mail = new helper.Mail(fromEmail, subject, toEmail, content);
            const category = new helper.Category("team-invite-notice");
            mail.addCategory(category);

            const noticeRequest = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: mail.toJSON()
            });

            plateSendgrid.API(noticeRequest, function(error, response) {
                console.log('sendgrid status: ' + response.statusCode);
                console.info('sendgrid: sending team invite notice to help@plate.work')
            });

            // Add contact to Sendgrid
            const contactRequest = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/contactdb/recipients',
                body: [
                    {
                        "email": opts.email
                    }
                ]
            });
            plateSendgrid.API(contactRequest, function(error, response) {
                console.log('sendgrid status: ' + response.statusCode);
                console.info('sendgrid: adding ' + opts.email + ' to contacts');
                // console.log(response.body);
                // console.log(response.headers);
            });
        });
    }

    static sendThanksForSigningUpEmail(user: IUser) {
        const helper = sendgrid.mail;
        const fromEmail = new helper.Email('hello@plate.work', 'Plate Team');
        const toEmail = new helper.Email(user.email);
        const subject = 'Welcome to Plate!';
        const content = new helper.Content('text/html', ' ');
        const mail = new helper.Mail(fromEmail, subject, toEmail, content);
        const category = new helper.Category("signup");
        mail.addCategory(category);

        mail.personalizations[0].addSubstitution(
            new helper.Substitution('-name-', user.name));
        mail.setTemplateId('d2fef161-041f-42fc-9d95-1c4ced10a198');

        const request = sendgrid.emptyRequest({
            method: 'POST',
            path: '/v3/mail/send',
            body: mail.toJSON()
        });

        plateSendgrid.API(request, function(error, response) {
            console.log('sendgrid status: ' + response.statusCode);
            console.info('sendgrid: sending welcome signup email to ' + user.email);
            // console.log(response.body);
            // console.log(response.headers);

            // Send notification to hello@plate.work
            const helper = sendgrid.mail;
            const fromEmail = new helper.Email('hello@plate.work', 'Plate.Work');
            const toEmail = new helper.Email('hello@plate.work');
            const subject = 'Plate User Signup: ' + user.email;
            const content = new helper.Content('text/plain', `
                    Plate User Signup: ${user.email}.\n\nKeep it up.
                `);
            const mail = new helper.Mail(fromEmail, subject, toEmail, content);
            const category = new helper.Category("signup-notice");
            mail.addCategory(category);
            const email = new helper.Email(Config.NewSignupNotificationEmail)
            mail.personalizations[0].addTo(email)

            const noticeRequest = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: mail.toJSON()
            });

            plateSendgrid.API(noticeRequest, function(error, response) {
                console.log('sendgrid status: ' + response.statusCode);
                console.info('sendgrid: sending signup notice email to hello@plate.work');
            });
        });

    }

    /**
     * Just sends a text email from hello@plate.work.
     * @param to
     * @param subject
     * @param body
     */
    static sendEmailGeneric(to: string, subject: string, body: string) {
        try {
            const helper = sendgrid.mail;
            const fromEmail = new helper.Email('hello@plate.work', 'Plate Team');
            const toEmail = new helper.Email(to);
            const content = new helper.Content('text/plain', body);
            const mail = new helper.Mail(fromEmail, subject, toEmail, content);

            const request = sendgrid.emptyRequest({
                method: 'POST',
                path: '/v3/mail/send',
                body: mail.toJSON()
            });

            plateSendgrid.API(request, function(error, response) {
                // Do nothing
            });
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Just sends us a report
     * @param text
     */
    static sendReport(subject: string, body: string) {
        try {
            this.sendEmailGeneric('hello@plate.work', subject, body);
        } catch (e) {
            console.error(e);
        }
    }

}
