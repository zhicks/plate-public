/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    print = require('gulp-print'),
    ts = require('gulp-typescript'),
    sourcemaps = require('gulp-sourcemaps'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    log = tasks.log,
    tsProject = ts.createProject(source.server_src + "/tsconfig.json")
    ;

module.exports = function (callback) {

    gutil.log('Building server typescript');

    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject))
        .js.pipe(sourcemaps.write())
        .pipe(gulp.dest(output.dist + '/server'));
};