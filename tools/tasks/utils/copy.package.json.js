/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    replace = require('gulp-replace'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    log = tasks.log
    ;

module.exports = function (callback) {
    gutil.log('Prod mode: Copy package.json to dist');

    // No return indicates that there are no racing conditions
    gulp.src('package.json')
        .pipe(replace('^', ''))
        .pipe(replace('~', ''))
        .pipe(gulp.dest(output.dist));
};