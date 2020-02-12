/**
 * Build Task
 */

var
  // dependencies
  gulp = require('gulp'),
  gutil = require('gulp-util'),
  runSequence = require('run-sequence'),

  // config
  config = require('./../config/gulp.config'),

  // task sequence
  tasks = []
  ;

require('./collections/build.client')(gulp);

module.exports = function (callback) {

  gutil.log('Building Plate Client');

  tasks.push('build-sass'); 
  //tasks.push('build-assets');
  tasks.push('build-javascript');
  tasks.push('build-html');
  tasks.push('build-client-ts');
  tasks.push('build-assets');
  tasks.push('build-semantic-copy');

  runSequence(tasks, callback);
};
