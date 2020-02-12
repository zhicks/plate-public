/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    concat = require('gulp-concat'),
    gutil = require('gulp-util'),
    merge = require('merge-stream'),
    clean = require('gulp-clean-css'),
    sass = require('gulp-sass'),
    symlink = require('gulp-sym'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    cssConf = config.env.css,

    log = tasks.log
    ;

module.exports = function (callback) {

    gutil.log('Building sass');

    var semantic = gulp.src(source.semantic + '/dist/semantic' + cssConf.ext);
    var plateVendors = gulp.src(source.semantic + '/dist/semantic' + cssConf.ext, cssConf.inject.plate.vendors)
        .pipe(concat('plate.vendors.css'));

    // compile sass
    var outside = gulp.src(source.client_src + '/outside/sass/**')
        .pipe(sass().on('error', sass.logError))
        .pipe(concat('outside.style.scss'));

    var plate = gulp.src(source.client_src + '/plate/sass/**')
        .pipe(sass().on('error', sass.logError))
        .pipe(concat('plate.style.scss'));

    var shared = gulp.src(source.client_src + '/shared/sass/*.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(concat('shared.style.scss'));

    var mergedOutside = merge(semantic, outside, shared)
        .pipe(concat('outside.style' + cssConf.ext))
        .pipe(config.isProduction ? clean(tasks.clean) : gutil.noop())
        .pipe(gulp.dest(output.dist + '/client/shared/css'));

    var mergedPlate = merge(plateVendors, plate, shared)
        .pipe(concat('plate.style' + cssConf.ext))
        .pipe(config.isProduction ? clean(tasks.clean) : gutil.noop())
        .pipe(gulp.dest(output.dist + '/client/shared/css'));

    var mergedShared = merge(semantic, shared)
        .pipe(concat('shared.style' + cssConf.ext))
        .pipe(config.isProduction ? clean(tasks.clean) : gutil.noop())
        .pipe(gulp.dest(output.dist + '/client/shared/css'));

    return merge(mergedOutside, mergedPlate, mergedShared);
};