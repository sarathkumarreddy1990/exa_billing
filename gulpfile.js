const gulp = require('gulp');
const clean = require('gulp-clean');
const less = require('gulp-less');
//const del = require('del');
const cleanCss = require('gulp-clean-css');
const concatCss = require('gulp-concat-css');
const uglifyCss = require('gulp-uglifycss');
//const amdOptimize = require('amd-optimize');
const requirejs = require('requirejs');
const requirejsConfig = require('./app/js/main.config').rjsConfig;
const zip = require('gulp-zip');

const path = require('path');


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
        .pipe(gulp.dest('./dist/css'))
});

/// TODO: Auto prefix
gulp.task('minify-css', ['less'], () => {
    return gulp.src([
        './app/node_modules/bootstrap/dist/css/bootstrap.min.css',
        './app/node_modules/select2/dist/css/select2.min.css',
        './app/node_modules/bootstrap-multiselect/dist/css/bootstrap-multiselect.css',
        './app/node_modules/bootstrap-daterangepicker/daterangepicker.css',
        './app/node_modules/font-awesome/css/font-awesome.css',
        './app/libs/datetimepicker/less/bootstrap-datetimepicker-build.css',
        './app/libs/jqgrid/css/ui.jqgrid.css',
        './dist/css/index.css',
    ])
        .pipe(cleanCss({ debug: true }, (details) => {
            console.log(`${details.name}: ${details.stats.originalSize}`);
            console.log(`${details.name}: ${details.stats.minifiedSize}`);
        }))
        .pipe(gulp.dest('./dist/css-min'))
});

gulp.task('concat-css', ['minify-css'], () => {
    return gulp.src([
        './dist/css-min/bootstrap.min.css',
        './dist/css-min/select2.min.css',
        './dist/css-min/bootstrap-multiselect.css',
        './dist/css-min/daterangepicker.css',
        './dist/css-min/font-awesome.css',
        './dist/css-min/bootstrap-datetimepicker-build.css',
        './dist/css-min/ui.jqgrid.css',
        './dist/css-min/index.css',
    ])
        .pipe(concatCss('index.min.css'))
        .pipe(gulp.dest('./dist/css'))
});

gulp.task('uglify-css', ['concat-css'], () => {
    return gulp.src([
        './dist/css/index.min.css',
    ])
        .pipe(uglifyCss({
            maxLineLen: 80,
            uglyComments: true
        }))
        .pipe(gulp.dest('./dist/css-final'))
});

gulp.task('zip', ['copy'], () => {
    return gulp.src('./build/**')
        .pipe(zip('exa-billing-build.zip'))
        .pipe(gulp.dest('./dist'));
});

gulp.task('clean-all', ['zip'], () => {
    return gulp.src('./build')
        .pipe(clean());
});

gulp.task('amdBuild', () => {
    //
});

gulp.task('requirejsBuild', (done) => {
    requirejsConfig.name = 'main';
    requirejsConfig.baseUrl = './app/js/main.js';
    requirejsConfig.out = 'main.dist.js';
    requirejsConfig.optimize = 'uglify';

    requirejs.optimize(requirejsConfig, function () {
        done();
    }, function (error) {
        console.error('requirejs task failed', JSON.stringify(error))
        process.exit(1);
    });
});

gulp.task('build', [
    'clean',
    'copy',
    'zip',
    'clean-all'
]);


gulp.task('default', ['requirejsBuild'], () => {
    //console.log('done');
});
