/**
 * Build Task
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    gutil = require('gulp-util'),

    // dependencies
    spawn = require('child_process').spawn,

    // config
    config = require('./../config/gulp.config'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    // task sequence
    tasks = []
    ;

module.exports = function (callback) {

    gutil.log('Building semantic. Hang tight!');

    process.chdir(source.semantic);

    tasks = ['build'];

    var child = spawn('gulp', tasks);

    // Print output from Gulpfile
    child.stdout.on('data', function (data) {
        if (data && !config.isProduction) {
            console.log(data.toString());
        }
    });

    child.on('exit', function(code) {
        // callback(code === 0 ? null :'ERROR: Semantic build process exited with code: ' +code);
        return callback();
    });
};