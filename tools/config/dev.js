/**
 * Config file for gulp dev
 */

var gulp = require('gulp');

var isProduction = process.env.NODE_ENV === 'production' ? true : false;
var dist = isProduction ? 'dist/prod' : 'dist/dev';

module.exports = {
    environment: isProduction ? 'production' : 'development',
    paths: {
        output: {
            dist: dist
        }
    },
    css: {
        ext: '.css',
        concat: {
            semantic: '',
        },
        inject: {
            outside: {
                sources: [
                    '/shared/css/outside.style.css'
                ]
            },
            plate: {
                sources: [
                    '/shared/css/plate.style.css'
                ],
                vendors: [
                    'node_modules/dragula/dist/dragula.css'
                ]
            },
            plain: {
                sources: [
                    '/shared/css/shared.style.css'
                ],
            },
            shared: {
                sources: [
                    ''
                ],
            },
        }
    },
    js: {
        ext: '.js',
        inject: {
            outside: {
                sources: [
                    '/shared/scripts/v/semantic-helper-functions.js',
                    '/os/systemjs.config.js'
                ],
            },
            plate: {
                sources: [
                    '/shared/scripts/v/jquery.mousewheel.js',
                    '/shared/scripts/v/html-css-sanitizer-bundle.js',
                    '/shared/scripts/v/moment.js',
                    '/shared/scripts/v/socket.io.min.js',
                    '/ps/systemjs.config.js'
                ],
            },
            plain: {
                sources: [
                    'https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js',
                    'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.2/semantic.js',
                    '/shared/scripts/v/plain-login-helper.js',
                    '/shared/scripts/v/plain-register-helper.js'
                ],
            },
            shared: {
                sources: [
                    '/shared/scripts/v/jquery.2.2.4.min.js',
                    'node_modules/core-js/client/shim.min.js',
                    'node_modules/zone.js/dist/zone.js',
                    'node_modules/reflect-metadata/Reflect.js',
                    'node_modules/systemjs/dist/system.src.js',
                    '/shared/scripts/v/semantic.js',
                ],
            }
        }
    },
    ga: {
        outside: {
            src: gulp.src('src/client/shared/scripts/ga/dev-mode-ga.js'),
            tpl: '<script>%s</script>'
        },
        plate: {
            src: gulp.src('src/client/shared/scripts/ga/dev-mode-ga.js'),
            tpl: '<script>%s</script>'
        }
    }
};