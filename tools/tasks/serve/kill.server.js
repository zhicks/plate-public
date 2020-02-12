/** 
 * Clean dist
 */

var
    gutil = require('gulp-util'),
    exec = require('child_process').exec,
    config = require('./../../config/gulp.config')
    ;

module.exports = function (callback) {
    gutil.log('Killing server');

    return exec('pkill -f "server.js"');

};