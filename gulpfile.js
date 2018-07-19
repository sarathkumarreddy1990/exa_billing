const gulp = require('gulp');
const runSequence = require('run-sequence');
const pump = require('pump');
const clean = require('gulp-clean');
const install = require('gulp-install');
const less = require('gulp-less');
const uglify = require('gulp-uglify');
//const del = require('del');
const cleanCss = require('gulp-clean-css');
const concat = require('gulp-concat');
//const concatCss = require('gulp-concat-css');
const requirejs = require('requirejs');
const replace = require('gulp-replace');
const zip = require('gulp-zip');
const bump = require('gulp-bump');
const git = require('gulp-git');

const fs = require('fs');
const path = require('path');

let currentBranch = 'develop';
let requirejsConfig = require('./app/js/main').rjsConfig;

let getCurrentVersion = function () {
    const package = JSON.parse(fs.readFileSync('./package.json'));
    return package.version;
};


gulp.task('clean', () => {
    return gulp.src(['./build', './build2', './dist'])
        .pipe(clean());
});

gulp.task('copy', ['clean'], () => {
    return gulp.src([
        './**',
        '!./test/**',
        '!./node_modules/**',
        '!./app/node_modules/**'
    ])
        .pipe(gulp.dest('./build'));
});

gulp.task('install', ['copy'], () => {
    return gulp.src(['./build/package.json', './build/app/package.json'])
        .pipe(install({
            //npm: '--production'
            production: true,
            commands: {
                'package.json': 'yarn'
            },
            yarn: ['--prod', '--silent']
        }));
});

gulp.task('less', ['install'], () => {
    return gulp.src('./app/skins/default/*.less')
        .pipe(less({
            paths: [path.join(__dirname, 'app/skins/default/index.less')]
        }))
        .pipe(gulp.dest('./build/app/skins/default'))
    //.pipe(gulp.dest('./app/skins/default'))
});

// /// TODO: Auto prefix
// gulp.task('concat-css', ['less'], () => {
//     return gulp.src([
//         './app/node_modules/bootstrap/dist/css/bootstrap.min.css',
//         './app/node_modules/select2/dist/css/select2.min.css',
//         './app/node_modules/bootstrap-multiselect/dist/css/bootstrap-multiselect.css',
//         './app/node_modules/bootstrap-daterangepicker/daterangepicker.css',
//         './app/node_modules/font-awesome/css/font-awesome.css',
//         './app/libs/datetimepicker/less/bootstrap-datetimepicker-build.css',
//         './app/libs/jqgrid/css/ui.jqgrid.css'
//     ])
//         .pipe(concat('index.min.css'))
//         //.pipe(gulp.dest('./dist/css'))
//         .pipe(gulp.dest('./app/skins/default'))
// });

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

gulp.task('compress', ['requirejsBuild'], (done) => {
    pump([
        gulp.src('./build/app/js/main.js'),
        uglify(),
        gulp.dest('./build/app/js')
    ], done);
});

gulp.task('compress2', (done) => {
    pump([
        gulp.src(['./app/js/**/**.js', '!./app/js/workers/*.js']),
        uglify(),
        gulp.dest('./build2/app/js')
    ], done);
});

gulp.task('bump', ['compress'], () => {
    return gulp.src('./package.json')
        .pipe(bump({ type: 'patch' }))
        .pipe(gulp.dest('./'));
});

gulp.task('copy-package-json', ['bump'], () => {
    return gulp.src([
        './package.json'
    ])
        .pipe(gulp.dest('./build'));
});

gulp.task('replace', ['copy-package-json'], () => {
    let version = getCurrentVersion();

    return gulp.src('./build/server/**/*.pug')
        .pipe(replace(/(\.js|\.css)(\s*'\s*)/g, `$1?v=${version}'`))
        .pipe(gulp.dest('./build/server/'));
});

gulp.task('zip', ['replace'], () => {
    let version = getCurrentVersion();

    return gulp.src('./build/**')
        .pipe(zip(`exa-billing-${currentBranch}-${version}.zip`))
        .pipe(gulp.dest('./dist'));
});

gulp.task('clean-all', ['zip'], () => {
    return gulp.src('./build')
        .pipe(clean());
});

gulp.task('bump-release', () => {
    return gulp.src('./package.json')
        .pipe(bump({ type: 'minor' }))
        .pipe(gulp.dest('./'));
});

gulp.task('git-init', (done) => {
    git.init((err) => {
        if (err) throw err;

        git.revParse({ args: '--abbrev-ref HEAD' }, function (err, branch) {
            currentBranch = branch;
            done();
        });
    });
});

gulp.task('git-add', ['git-init'], () => {
    return gulp.src('./package.json')
        .pipe(git.add());
});

gulp.task('git-commit', ['git-add'], () => {
    let version = getCurrentVersion();

    return gulp.src('./package.json')
        .pipe(git.commit(`Build v${version}`));
});

gulp.task('git-pull', ['git-commit'], (done) => {
    git.pull('origin', currentBranch, { args: '--rebase' }, (err) => {
        if (err) throw err;
        done();
    });
});

gulp.task('git-push', (done) => {
    git.push('origin', currentBranch, (err) => {
        if (err) throw err;
        done();
    });
});

gulp.task('build', [
    'clean',
    'copy',
    'requirejsBuild',
    'bump',
    'replace',
    'zip',
    'clean-all',
]);

gulp.task('build-from-repo', (done) => {
    runSequence('git-pull', 'build', 'git-commit', 'git-push', done);
});


gulp.task('default', ['requirejsBuild'], () => {
    //console.log('done');
});
