/**
 * Plate Gulpfile
 */

var
    gulp = require('gulp'),

    // gulp dependencies
    browserify = require('browserify'),
    concat = require('gulp-concat'),
    del = require('del'),
    gutil = require('gulp-util'),
    gzip = require('gulp-gzip'),
    merge = require('merge-stream'),
    sysBuilder = require('systemjs-builder'),
    ts = require('gulp-typescript'),
    uglify = require('gulp-uglify'),

    // dependencies
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    runSequence = require('run-sequence'),

    // config
    config = require('./tools/config/gulp.config'),
    tasks = require('./tools/config/tasks'),

    // shorthand
    assets = config.paths.assets,
    output = config.env.paths.output,
    source = config.paths.source,

    log = tasks.log,

    // Gulp Tasks
    buildClient = require('./tools/tasks/build.client'),
    buildServer = require('./tools/tasks/build.server'),

    // Utilities
    buildSemantic = require('./tools/tasks/build.client.semantic'),

    clean = require('./tools/tasks/utils/clean'),
    cleanAll = require('./tools/tasks/utils/clean.all'),
    killServer = require('./tools/tasks/serve/kill.server'),
    runServer = require('./tools/tasks/serve/run.server')
    ;

// ---------------------------------------------------- Build tasks
gulp.task('build', ['clean'], function (callback) {
    runSequence(['build.client', 'build.server'], callback);
});

// TODO - FIX THIS ASAP
// ---------------------------------------------------- Client Build tasks
gulp.task('build.client', buildClient);
gulp.task('client', ['build.client']);

gulp.task('bundle.app', function () {
    gutil.log('Hang tight for 10-20 seconds!');
    var outside = gulp.src(['dist/prod/client/outside/libs/js/vendors.js', 'dist/prod/client/outside/bundle.js'])
        .pipe(concat('app.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist/prod/client/outside/'));

    var plate = gulp.src(['dist/prod/client/plate/libs/js/vendors.js', 'dist/prod/client/plate/bundle.js'])
        .pipe(concat('app.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist/prod/client/plate/'));

    return merge(outside, plate);
});

gulp.task('build.gzip', function () {
    return gulp.src('dist/prod/client' + '/**/*.{html,xml,json,css,js}')
        .pipe(gzip())
        .pipe(gulp.dest('dist/prod/client'));
});

gulp.task('bundle.vendors', function () {
    // concatenate non-angular2 libs, shims & systemjs-config

    var outside = gulp.src([
        'src/client/shared/scripts/v/jquery.2.2.4.min.js',
        'src/client/shared/semantic/dist/semantic.js',
        'src/client/shared/scripts/v/semantic-helper-functions.js',
        'node_modules/core-js/client/shim.min.js',
        'node_modules/zone.js/dist/zone.js',
        'node_modules/reflect-metadata/Reflect.js',
        'node_modules/systemjs/dist/system.src.js',
    ]).pipe(concat('vendors.js'))
        .pipe(gulp.dest('dist/prod/client/outside/libs/js'));

    var plate = gulp.src([
        'src/client/shared/scripts/v/jquery.2.2.4.min.js',
        'src/client/shared/semantic/dist/semantic.js',
        'src/client/shared/scripts/v/jquery.mousewheel.js',
        'src/client/shared/scripts/v/html-css-sanitizer-bundle.js',
        'src/client/shared/scripts/v/moment.js',
        'src/client/shared/scripts/v/socket.io.min.js',
        'node_modules/core-js/client/shim.min.js',
        'node_modules/zone.js/dist/zone.js',
        'node_modules/reflect-metadata/Reflect.js',
        'node_modules/systemjs/dist/system.src.js',
    ]).pipe(concat('vendors.js'))
        .pipe(gulp.dest('dist/prod/client/plate/libs/js'));

    var plain = gulp.src([
        'src/client/shared/scripts/v/plain-login-helper.js',
        'src/client/shared/scripts/v/plain-register-helper.js'
    ]).pipe(concat('login-register-helper.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist/prod/client/shared/scripts/'));

    return merge(outside, plate);
});

gulp.task('build.cleanup', function (callback) {

    return del([
        output.dist + '/client/outside/app',
        output.dist + '/client/outside/libs',
        output.dist + '/client/outside/bundle.js',
        output.dist + '/client/outside/systemjs.config.js',
        output.dist + '/client/plate/app/**/*.js',
        output.dist + '/client/plate/libs',
        output.dist + '/client/plate/bundle.js',
        output.dist + '/client/plate/systemjs.config.js',
        output.dist + '/client/shared/scripts/auth.service.js',
        output.dist + '/client/shared/scripts/util.service.js',
        output.dist + '/client/shared/scripts/directives',
        output.dist + '/client/shared/scripts/v/'
    ], callback);
});

// ---------------------------------------------------- Server Build Tasks
gulp.task('build.server', buildServer);
gulp.task('server', ['build.server']);


// ---------------------------------------------------- Utilities
gulp.task('build.semantic', buildSemantic);
gulp.task('clean', clean);
gulp.task('clean.all', cleanAll);
gulp.task('kill.server', killServer);


// ---------------------------------------------------- Watch Task
// TODO - update watch task
gulp.task('watch', ['run.server'], function () {
    gulp.watch(config.watch.client.sass, ['build-sass']);
    gulp.watch(config.watch.client.ts, ['build-client-ts']);
    gulp.watch(config.watch.client.html, ['build-html']);
    gulp.watch(config.watch.shared.scripts, ['build-javascript']);
    gulp.watch(config.watch.server.ts, ['build.server']);
});

// ---------------------------------------------------- Run Tasks
gulp.task('run', ['run.server']);

gulp.task('run.server', function () {
    // TODO - Set server path to bundled server.js
    var serverPath = output.dist + '/server/src/server.js';

    var server = spawn('node', [serverPath]);
    server.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });
    server.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });
    server.on('exit', function (code) {
        console.log('child process exited with code ' + code);
    });
});

// ---------------------------------------------------- `npm run serve` Tasks
// Serve 
gulp.task('serve', function (callback) {
    runSequence('build', 'run', callback);
});


// TODO - create serve.prod task

// ---------------------------------------------------- Default task
gulp.task('default', ['build']);
