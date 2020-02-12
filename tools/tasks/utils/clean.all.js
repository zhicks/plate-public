/** 
 * Clean dist
 */

var
    gutil = require('gulp-util'),
    del = require('del'),
    config = require('./../../config/gulp.config')
    ;

module.exports = function (callback) {
    gutil.log('Removing ' + config.paths.clean.all);
    return del([config.paths.clean.all], callback);
};