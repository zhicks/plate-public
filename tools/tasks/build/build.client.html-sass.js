/**
 * Build Task
 */

var
    // dependencies
    gulp = require('gulp'),
    gutil = require('gulp-util'),
    runSequence = require('run-sequence'),

    // config
    config = require('./../../config/gulp.config'),

    // task sequence
    tasks = []
    ;

require('../collections/build.client')(gulp);

module.exports = function (callback) {

    gutil.log('Building Plate Client HTML + Sass');

    tasks.push('build-sass');
    tasks.push('build-html');

    runSequence(tasks, callback);
};
