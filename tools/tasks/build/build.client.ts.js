/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),
    // inlineNg2Template = require('gulp-inline-ng2-template'),
    merge = require('merge-stream'),
    print = require('gulp-print'),
    ts = require('gulp-typescript'),

    // config
    config = require('./../../config/gulp.config'),
    tasks = require('./../../config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    log = tasks.log,
    tsProject = ts.createProject(source.client_src + "/tsconfig.json")
    ;

module.exports = function (callback) {

    gutil.log('Building client typescript');

    // Compiles and copies keeping directory structure
    return tsProject.src()
        //.pipe(sourcemaps.init())
        // First attempt to remove template html
        // .pipe(config.isProduction ? inlineNg2Template({ 
        //     base: 'src/client', 
        //     customFilePath: function(ext, file) { 
        //         return file.replace(/ps/i, "plate"); 
        //     }, 
        //     useRelativePaths: false 
        // }) : gutil.noop())
        .pipe(ts(tsProject))
        //.js.pipe(sourcemaps.write())
        .pipe(gulp.dest(output.dist + "/client"));
};