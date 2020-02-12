/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    print = require('gulp-print'),
    symlink = require('gulp-sym'),
    gunzip = require('gulp-gunzip'),
    untar = require('gulp-untar'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    log = tasks.log
    ;

module.exports = function(callback) {
    gutil.log('Dev mode: Symlinking node_modules');

    return gulp.src('node_modules')
        .pipe(symlink(output.dist + '/server/node_modules', { force: true }));
};