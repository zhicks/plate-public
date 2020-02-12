/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    merge = require('merge-stream'),

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

    gutil.log('Building assets');

    // Build assets
    var outside = gulp.src(source.client_src + '/outside/assets/**')
        .pipe(gulp.dest(output.dist + '/client/outside/assets'));

    var plate = gulp.src(source.client_src + '/plate/assets/**')
        .pipe(gulp.dest(output.dist + '/client/plate/assets'));

    var shared = gulp.src(source.client_src + '/shared/assets/**')
        .pipe(gulp.dest(output.dist + '/client/shared/assets'));

    return merge(outside, plate, shared);
};