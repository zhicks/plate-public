/** 
 * Run Server
 */

var
    gutil = require('gulp-util'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    config = require('./../../config/gulp.config')
    ;

module.exports = function (callback) {
    gutil.log('Starting server');

    var server = spawn('node', [output.dist + '/server/src/server.js']);
    server.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });
    server.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });
    server.on('exit', function (code) {
        console.log('child process exited with code ' + code);
    });

    return;
};