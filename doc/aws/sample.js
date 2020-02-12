/**
 * Node documentation here: http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-intro.html
 */

// Load the SDK 
var AWS = require('aws-sdk');

/**
 * Create an S3 client
 * 
 * Staging keys can be found in deploy/vars/{staging|prod}-config.yml
 * ENV_VAR: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
 * 
 * The provided keys are for the plate-dev user on AWS
 * plate-dev user only has RW access to plate-dev bucket
 */
var s3Options = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIAJZS636WZ5IYGMMIQ',
    secretAccessKey: process.env.AWS_ACCESS_KEY_ID || 'igncJvWS9S6gEpipz5ST5MVnO17K38WadNp6+Q34'
}
var s3 = new AWS.S3(s3Options);

/**
 * EXAMPLE: Upload to bucket
 * bucketName is set in deploy/vars/{staging|prod}-config.yml
 * ENV_VAR: AWS_BUCKET_NAME
 */
var bucketName = process.env.AWS_BUCKET_NAME || 'plate-dev';
var folderName = 'attachments';
var keyName = folderName + '/' + 'hello_world.txt';

var params = {
    Bucket: bucketName,
    Key: keyName,
    Body: 'Hello World!'
};
s3.putObject(params, function (err, data) {
    if (err) {
        console.log(err)
    } else {
        console.log("Successfully uploaded data to " + bucketName + "/" + keyName);
    }
});


/**
 * EXAMPLE: Read from bucket 
 */
var params = {
    Bucket: bucketName,
    Key: keyName
};
s3.getObject(params, function (err, data) {
    if (err) {
        console.log(err, err.stack);
    } else {
        console.log(data.Body.toString());
    }
});

/**
 * EXAMPLE: Read from bucket then convert to stream
 */
var params = {
    Bucket: bucketName,
    Key: keyName
};
var file = require('fs').createWriteStream('./hello_world.txt');
s3.getObject(params).createReadStream().pipe(file);