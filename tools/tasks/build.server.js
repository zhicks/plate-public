/**
 * Build Task
 */

var
  gulp = require('gulp'),
  // dependencies
  gutil = require('gulp-util'),
  runSequence = require('run-sequence'),

  // config
  config = require('./../config/gulp.config'),

  // task sequence
  tasks = []
  ;

require('./collections/build.server')(gulp);

module.exports = function (callback) {

  gutil.log('Building Plate Server');

  tasks.push('kill-server');
  tasks.push('build-server-ts');
  
  if (!config.isProduction) {
    tasks.push('build-server-link');
  } else {
    tasks.push('copy-package-json');
  }

  runSequence(tasks, callback);
};
