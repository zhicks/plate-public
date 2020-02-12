/*
 * Define Sub-Tasks
 */

module.exports = function (gulp) {

  var
    // build sub-tasks
    buildServerTS = require('./../build/build.server.ts'),
    buildServerLink = require('./../build/build.server.link'),
    killServer = require('./../serve/kill.server')
    copyPackageJson = require('./../utils/copy.package.json')
    ;

  // in case these tasks are undefined during import, less make sure these are available in scope
  gulp.task('kill-server', killServer);
  gulp.task('build-server-ts', buildServerTS);
  gulp.task('build-server-link', buildServerLink);
  gulp.task('copy-package-json', copyPackageJson);
};
