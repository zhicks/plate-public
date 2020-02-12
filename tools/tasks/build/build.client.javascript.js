/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    merge = require('merge-stream'),
    print = require('gulp-print'),

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

    gutil.log('Building scripts');

    var outside = gulp.src(source.client_src + '/outside/systemjs.config.js')
        .pipe(gulp.dest(output.dist + '/client/outside'));

    var plate = gulp.src(source.client_src + '/plate/systemjs.config.js')
        .pipe(gulp.dest(output.dist + '/client/plate'));

    var shared = gulp.src(source.client_src + '/shared/scripts/v/**')
        .pipe(gulp.dest(output.dist + '/client/shared/scripts/v'));

    return merge(outside, plate, shared);
};