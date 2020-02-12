/**
 * Config file for gulp
 */

var isProduction = process.env.NODE_ENV === 'production' ? true : false;
var isStaging = process.env.TARGET === 'staging' ? true : false;

var dist = isProduction ? 'dist/prod' : 'dist/dev';

module.exports = {
    env: isProduction ? require('./prod') : require('./dev'),
    isProduction: isProduction,
    isStaging: isStaging,
    watch: {
        client: {
            sass: 'src/client/**/*.scss',
            html: 'src/client/**/*.html',
            ts: 'src/client/**/*.ts'
        },
        shared: {
            scripts: 'src/client/shared/**/*.js'
        },
        server: {
            ts: 'src/server/src/**/*.ts'
        }
    },
    paths: {
        source: {
            client_src: 'src/client',
            server_src: 'src/server',
            semantic: 'src/client/shared/semantic'
        },
        clean: {
            all: 'dist/',
            dev: 'dist/dev/',
            staging: 'dist/staging/',
            production: 'dist/prod/',
            dist: process.env.NODE_ENV === 'production' ? 'dist/prod' : 'dist/dev'
        },
    }
};