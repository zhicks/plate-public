/*
 * Define Sub-Tasks
 */

module.exports = function (gulp) {

  var
    // build sub-tasks
    buildAssets = require('./../build/build.client.assets'),
    buildHTML = require('./../build/build.client.html'),
    buildJS = require('./../build/build.client.javascript'),
    buildHtmlSass = require('./../build/build.client.html-sass'),
    buildSASS = require('./../build/build.client.sass'),
    buildClientTS = require('./../build/build.client.ts'),
    buildSemanticCopy = require('./../build/build.client.semantic-copy'),
    buildSemantic = require('./../build.client.semantic')
    ;

    // in case these tasks are undefined during import, less make sure these are available in scope
    //   gulp.task('build-javascript', 'Builds all javascript from source', buildJS);
    gulp.task('build-assets', buildAssets);
    gulp.task('build-html', buildHTML);
    gulp.task('build-javascript', buildJS);
    gulp.task('build-sass', buildSASS);
    gulp.task('build-html-sass', buildSASS);
    gulp.task('build-client-ts', buildClientTS);
    gulp.task('build-semantic-copy', buildSemanticCopy);
    gulp.task('build-semantic', buildSemantic);

};
