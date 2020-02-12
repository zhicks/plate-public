const isProduction = process.env.NODE_ENV === 'production' ? true : false;
export class Keys {
    public static JWT_SECRET = isProduction ? process.env.JWT_SECRET: 'MY_SECRET';
    public static DB_URI = isProduction ? process.env.DB_URI: 'mongodb://localhost/plate';
    public static DB_USER = isProduction ? process.env.DB_USER: ''; // No user or pass for dev
    public static DB_PASS = isProduction ? process.env.DB_PASS: '';
    public static NODE_PORT = isProduction ? 9000 : 5000;
    public static SENDGRID_API_KEY = isProduction ? process.env.SENDGRID_API_KEY : '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';
    public static STRIPE_PUBLISHABLE_KEY = isProduction ? process.env.STRIPE_PUBLISHABLE_KEY : 'pk_test_RfuLpSKHM0iwlIy84zyRVUmd';
    public static STRIPE_SECRET_KEY = isProduction ? process.env.STRIPE_SECRET_KEY : 'sk_test_JGWonm2ki9hFHF04JVM2IIWm';
    public static S3_URL_BASE = 'https://s3.amazonaws.com';
    public static S3_DEV_BUCKET = 'plate-dev';
    public static S3_ATTACHMENTS_FOLDER = 'attachments';
    public static Providers = {
        Plate: {
            NAME: 'plate'
        },
        Google: {
            NAME: 'google',
            CLIENT_ID: isProduction ? process.env.GOOGLE_CLIENT_ID: '465840796478-39bl33r0dj1bkkvqolqcb1ajcv6ip0l7.apps.googleusercontent.com',
            CLIENT_SECRET: isProduction ? process.env.GOOGLE_CLIENT_SECRET: 'trOyF1uL8nuEYZJPsUyl6ypn',
            CALLBACK_URL: isProduction ? process.env.GOOGLE_CALLBACK_URL : '/auth/googlecallback' // For accounts
        },
        Gmail: {
            SCOPES: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
            CALLBACK_URL: isProduction ? process.env.GMAIL_CALLBACK_URL : 'http://localhost:5000/auth/gmailcallback',
            PUB_SUB_TOPIC_NAME: 'projects/plate-1375/topics/incoming-gmail'
        },
        Slack: {
            NAME: 'slack',
            CLIENT_ID: isProduction ? process.env.SLACK_CLIENT_ID: '41633133957.73233839634',
            CLIENT_SECRET: isProduction ? process.env.SLACK_CLIENT_SECRET: 'cb2768ba205beacd09bbc6843cd6cae1',
            CALLBACK_URL: isProduction ? process.env.SLACK_CALLBACK_URL : 'http://localhost:5000/auth/slackcallback',
            SCOPES: 'client'
        }
    }
}