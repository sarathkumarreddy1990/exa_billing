const gulp = require('gulp');
const clean = require('gulp-clean');
const less = require('gulp-less');
//const del = require('del');
const cleanCss = require('gulp-clean-css');
const concat = require('gulp-concat');
const concatCss = require('gulp-concat-css');
const requirejs = require('requirejs');
const zip = require('gulp-zip');
const path = require('path');

let requirejsConfig = require('./app/js/main').rjsConfig;


gulp.task('clean', () => {
    return gulp.src(['./build', './dist'])
        .pipe(clean());
});

gulp.task('copy', ['clean'], () => {
    return gulp.src('./**')
        .pipe(gulp.dest('./build'));
});

gulp.task('less', () => {
    return gulp.src('./app/skins/default/*.less')
        .pipe(less({
            paths: [path.join(__dirname, 'app/skins/default/index.less')]
        }))
        //.pipe(gulp.dest('./dist/css'))
        .pipe(gulp.dest('./app/skins/default'))
});

/// TODO: Auto prefix
gulp.task('concat-css', ['less'], () => {
    return gulp.src([
        './app/node_modules/bootstrap/dist/css/bootstrap.min.css',
        './app/node_modules/select2/dist/css/select2.min.css',
        './app/node_modules/bootstrap-multiselect/dist/css/bootstrap-multiselect.css',
        './app/node_modules/bootstrap-daterangepicker/daterangepicker.css',
        './app/node_modules/font-awesome/css/font-awesome.css',
        './app/libs/datetimepicker/less/bootstrap-datetimepicker-build.css',
        './app/libs/jqgrid/css/ui.jqgrid.css'
    ])
        .pipe(concat('index.min.css'))
        //.pipe(gulp.dest('./dist/css'))
         .pipe(gulp.dest('./app/skins/default'))
});

gulp.task('requirejsBuild', ['copy'], (done) => {

    requirejsConfig = {
        ...requirejsConfig,
        name: 'main',
        baseUrl: './app/js',
        out: './build/app/js/main.js',
        //out: './app/js/main.dist.js',
        optimize: 'uglify2',
        preserveLicenseComments: false,
        waitSeconds: 0,
        wrap: true,
        optimizeCss: "none",//standard",
        generateSourceMaps: false,
        uglify2: {
            mangle: false,
            codegen: {
                ascii_only: true
            }
        },
    };

    requirejs.optimize(requirejsConfig, function () {
        console.log(arguments);
        done();
    }, function (error) {
        console.error('requirejs task failed', error)
        process.exit(1);
    });
});

gulp.task('zip', ['requirejsBuild'], () => {
    return gulp.src('./build/**')
        .pipe(zip('exa-billing-build.zip'))
        .pipe(gulp.dest('./dist'));
});

gulp.task('clean-all', ['zip'], () => {
    return gulp.src('./build')
        .pipe(clean());
});

gulp.task('clean-all', ['zip'], () => {
    return gulp.src('./build')
        .pipe(clean());
});

gulp.task('build', [
    'clean',
    'copy',
    'requirejsBuild',
    'zip',
    'clean-all'
]);


gulp.task('default', ['requirejsBuild'], () => {
    //console.log('done');
});
