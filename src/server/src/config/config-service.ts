import { Keys } from '../../conf';
const username = require('username');

export class Config {
    public static Keys = Keys;
    /**
     * Expects a custom string for logging purposes
     * @param reason
     */
    public static HandleServerSideError = (reason: string) => {
        console.error(reason);
    }

    public static isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    public static getS3Url() {
        return `${Config.Keys.S3_URL_BASE}/${process.env.AWS_BUCKET_NAME || Config.Keys.S3_DEV_BUCKET}/`
    }
    public static keyFromS3Link(link: string) {
        if (link) {
            let urlFirstPart = Config.getS3Url();
            let lengthUrlFirstPart = urlFirstPart.length;
            let key = link.substring(lengthUrlFirstPart);
            return key;
        }
    }

    // During development, log the name of local username
    public static DeployByUser = process.env.DEPLOY_BY_USER || username.sync();

    // Email to send notifcations
    public static FeedbackNotificationEmail = process.env.FEEDBACK_EMAIL || 'notifications@plate.work';
    public static NewSignupNotificationEmail = process.env.NEW_SIGNUP_EMAIL || 'notifications@plate.work';
    public static CommitSHA = process.env.COMMIT_SHA || 'dev version';
}