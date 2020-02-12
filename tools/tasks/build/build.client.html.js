/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    htmlReplace = require('gulp-html-replace'),
    merge = require('merge-stream'),
    print = require('gulp-print'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    cssConf = config.env.css,
    gaConf = config.env.ga,
    jsConf = config.env.js,

    log = tasks.log
    ;

module.exports = function(callback) {

    gutil.log('Building html');

    // Build html
    var outside = gulp.src(source.client_src + '/outside/**/*.html')
        .pipe(gulp.dest(output.dist + '/client/outside'));

    var plate = gulp.src(source.client_src + '/plate/**/*.html')
        .pipe(gulp.dest(output.dist + '/client/plate'));

    var shared = gulp.src(source.client_src + '/shared/swig-views/*.html')
        .pipe(htmlReplace({
            'outside-css': cssConf.inject.outside.sources,
            'plate-css': cssConf.inject.plate.sources,
            'plain-css': cssConf.inject.plain.sources,
            'shared-css': cssConf.inject.shared.sources,
            'outside-js': jsConf.inject.outside.sources,
            'plate-js': jsConf.inject.plate.sources,
            'plain-js': jsConf.inject.plain.sources,
            'shared-js': jsConf.inject.shared.sources,
            'outside-ga': gaConf.outside,
            'plate-ga': gaConf.plate
        }))
        .pipe(gulp.dest(output.dist + '/client/swig-views'));


    return merge(outside, plate, shared);
};