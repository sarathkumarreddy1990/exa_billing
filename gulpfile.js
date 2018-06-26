const gulp = require('gulp');
const clean = require('gulp-clean');
const less = require('gulp-less');
//const del = require('del');
const cleanCss = require('gulp-clean-css');
const concat = require('gulp-concat');
const concatCss = require('gulp-concat-css');
const requirejs = require('requirejs');
const zip = require('gulp-zip');
const bump = require('gulp-bump');
const git = require('gulp-git');

const fs = require('fs');
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

gulp.task('less', ['copy'], () => {
    return gulp.src('./app/skins/default/*.less')
        .pipe(less({
            paths: [path.join(__dirname, 'app/skins/default/index.less')]
        }))
        .pipe(gulp.dest('./build/app/skins/default'))
    //.pipe(gulp.dest('./app/skins/default'))
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

gulp.task('requirejsBuild', ['less'], (done) => {

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

gulp.task('bump', ['clean-all'], () => {
    return gulp.src('./package.json')
        .pipe(bump({ type: 'patch' }))
        .pipe(gulp.dest('./'));
});

gulp.task('bump-release', () => {
    return gulp.src('./package.json')
        .pipe(bump({ type: 'minor' }))
        .pipe(gulp.dest('./'));
});

gulp.task('git-init', () => {
    git.init((err) => {
        if (err) throw err;
    });
});

gulp.task('git-add', ['git-init'], () => {
    return gulp.src('./package.json')
        .pipe(git.add());
});

gulp.task('git-commit', ['git-add'], () => {
    let newVersion;

    const package = JSON.parse(fs.readFileSync('./package.json'));
    newVersion = package.version;

    return gulp.src('./package.json')
        .pipe(git.commit(`Build v${newVersion}`));
});

gulp.task('git-push', ['bump', 'git-commit'], () => {
    git.push('origin', 'develop', (err) => {
        if (err) throw err;
    });
});

gulp.task('build', [
    'clean',
    'copy',
    'requirejsBuild',
    'zip',
    'clean-all',
    'bump',
    'git-push',
]);


gulp.task('default', ['requirejsBuild'], () => {
    //console.log('done');
});
