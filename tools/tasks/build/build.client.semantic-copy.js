/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    merge = require('merge-stream'),
    print = require('gulp-print'),

    // dependencies
    fs = require('fs'),

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

    gutil.log('Copying semantic');

    // Copy over semantic dist to shared dist
    // This task does NOT build - that's above
    // TODO - We should only copy over the minified JS and CSS

    try {
        fs.statSync(source.semantic + '/dist'); // This will throw if not exist

        // TODO - compile into custom semantic build
        var semanticThemes = gulp.src(source.semantic + '/dist/themes/**')
            .pipe(gulp.dest(output.dist + '/client/shared/css/themes', { force: true }));

        var semanticComponents = gulp.src(source.semantic + '/dist/components/**')
            .pipe(gulp.dest(output.dist + '/client/shared/css/components', { force: true }));

        // TODO - combine with JS bundle
        var semanticJs = gulp.src(source.semantic + '/dist/semantic' + config.env.js.ext)
            .pipe(gulp.dest(output.dist + '/client/shared/scripts/v'))

        return merge(semanticThemes, semanticComponents);

    } catch (e) {
        console.error('Semantic dist not found in /client/shared/semantic/dist. You need to run "gulp build.semantic"' + '\nerror: ' + e);
    }
};