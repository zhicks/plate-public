/**
 * Config file for gulp dev
 */

var gulp = require('gulp');

var isProduction = process.env.NODE_ENV === 'production' ? true : false;
var isStaging = process.env.TARGET === 'staging' ? true : false;

var dist = isProduction ? 'dist/prod' : 'dist/dev';

module.exports = {
    environment: isProduction ? 'production' : 'development',
    paths: {
        output: {
            dist: dist
        }
    },
    css: {
        ext: '.min.css',
        concat: {
            semantic: '',
        },
        inject: {
            outside: {
                sources: [
                    '/shared/css/outside.style.min.css'
                ]
            },
            plate: {
                sources: [
                    '/shared/css/plate.style.min.css'
                ],
                vendors: [
                    'node_modules/dragula/dist/dragula.css'
                ]
            },
            plain: {
                sources: [
                    '/shared/css/shared.style.min.css'
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
        ext: '.min.js',
        inject: {
            outside: {
                sources: [
                    // '/os/libs/js/vendors.min.js',
                    // 'shared/scripts/v/semantic-helper-functions.js'
                    '/os/app.min.js'
                ],
                sources_end: [
                    ''
                ]

            },
            plate: {
                sources: [
                    '/ps/app.min.js'
                ],
                sources_end: [
                    ''
                ]
            },
            plain: {
                sources: [
                    'https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js',
                    'https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.2/semantic.js',
                    '/shared/scripts/login-register-helper.min.js'
                ],
                sources_end: [
                    ''
                ]
            },
            shared: {
                sources: [
                    // 'node_modules/core-js/client/shim.min.js',
                    // 'node_modules/zone.js/dist/zone.js',
                    // 'node_modules/reflect-metadata/Reflect.js',
                    // 'node_modules/systemjs/dist/system.src.js',
                    // '/shared/scripts/v/semantic.js',
                ],
                sources_end: [
                    ''
                ]
            }
        }
    },
    ga: {
        outside: {
            src: isStaging ? gulp.src('src/client/shared/scripts/ga/staging-ga.js') : gulp.src('src/client/shared/scripts/ga/outside-ga.js'),
            tpl: '<script>%s</script>'
        },
        plate: {
            src: isStaging ? gulp.src('src/client/shared/scripts/ga/staging-ga.js') : gulp.src('src/client/shared/scripts/ga/plate-ga.js'),
            tpl: '<script>%s</script>'
        }
    }
};