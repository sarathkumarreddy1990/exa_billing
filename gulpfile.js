const gulp = require('gulp');
const runSequence = require('run-sequence');
const pump = require('pump');
const clean = require('gulp-clean');
const install = require('gulp-install');
const less = require('gulp-less');
const uglify = require('gulp-uglify');
const requirejs = require('requirejs');
const replace = require('gulp-replace');
const zip = require('gulp-zip');
const bump = require('gulp-bump');
const git = require('gulp-git');
const gutil = require('gulp-util');
const ftp = require('vinyl-ftp');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const semver = require('semver');

let currentBranch = 'GitInitTaskDidNotRun';
let currentCommit = 'GitInitTaskDidNotRun';
let timestamp = moment().format("YYYYMMDDhhmm");
let requirejsConfig = require('./app/js/main').rjsConfig;

const getPackageJson = () => {
    const package = JSON.parse(fs.readFileSync('./package.json'));
    if (!package) {
        gutil.log('package.json | unable to read file');
        process.exit(1);
    }
    return package;
};

gulp.task('check-build-environment', () => {
    const pkg = getPackageJson();
    const engines = pkg.engines;
    if (!engines) {
        gutil.log('package.json | engines is missing');
        process.exit(1);
    }
    //gutil.log('engines: ' + JSON.stringify(engines, null, 2));
    const requiredNodeVersion = engines.node;
    const requiredNpmVersion = engines.npm;
    if (!requiredNodeVersion) {
        gutil.log('package.json | engines.node is missing!');
        process.exit(1);
    }
    if (!requiredNpmVersion) {
        gutil.log('package.json | engines.npm is missing!');
        process.exit(1);
    }
    const currentNodeVersion = process.version;
    const currentNpmVersion = childProcess.execSync('npm -v').toString('utf-8').trim();
    //gutil.log(`node -> required: ${requiredNodeVersion}, current: ${currentNodeVersion}`);
    //gutil.log(`npm  -> required: ${requiredNpmVersion}, current: ${currentNpmVersion}`);
    if (!semver.satisfies(currentNodeVersion, requiredNodeVersion)) {
        gutil.log(`Invalid build environment - required node version: ${requiredNodeVersion}, current version: ${currentNodeVersion}`);
        process.exit(1);
    }
    if (!semver.satisfies(currentNpmVersion, requiredNpmVersion)) {
        gutil.log(`Invalid build environment - required npm version: ${requiredNpmVersion}, current version: ${currentNpmVersion}`);
        process.exit(1);
    }
    gutil.log('Build environment is valid!');
});

gulp.task('clean', () => {
    return gulp.src(['./build', './build2', './dist'])
        .pipe(clean());
});

gulp.task('copy', ['clean'], () => {
    return gulp.src([
        './**',
        '!./test/**',
        '!./node_modules/**',
        '!./app/node_modules/**',
        '!./yarn.lock',
        '!./app/yarn.lock',
        '!./*.code-workspace'
    ])
        .pipe(gulp.dest('./build'));
});

gulp.task('install', ['copy'], () => {
    return gulp.src(['./build/package.json', './build/app/package.json'])
        .pipe(install({
            // npm: '--production',
            production: true,
            // commands: {
            //     'package.json': 'yarn'
            // },
            // yarn: ['--prod', '--silent']
        }));
});

/// TODO: Following two tasks should be combined
gulp.task('less-default', ['install'], () => {
    return gulp.src('./app/skins/default/*.less')
        .pipe(less({
            paths: [path.join(__dirname, 'app/skins/default/index.less')]
        }))
        .pipe(gulp.dest('./build/app/skins/default'));
});

gulp.task('less', ['less-default'], () => {
    return gulp.src([
        './app/skins/dark/*.less'
    ])
        .pipe(less({
            paths: [
                path.join(__dirname, 'app/skins/dark/index.less')
            ]
        }))
        .pipe(gulp.dest('./build/app/skins/dark'));
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

gulp.task('bump', ['git-init', 'compress'], () => {
    const bumpType = getBumpType({branch: currentBranch});
    const dirtyPreID = currentBranch + ( currentBranch === 'release' ? '' : '-' + currentCommit );
    const preID = dirtyPreID.replace(/_/g, '-');
    return gulp.src('./package.json')
        .pipe(bump({ type: bumpType, preid: preID }))
        .pipe(gulp.dest('./'));
});

function getBumpType(options) {
    if (options.branch.startsWith('release')) {
        return 'patch';
    } else if (options.branch.startsWith('testing')) {
        return 'patch';
    } else {
        return 'prerelease';
    }
}

gulp.task('copy-package-json', ['bump'], () => {
    return gulp.src([
        './package.json'
    ])
        .pipe(gulp.dest('./build'));
});

gulp.task('replace', ['copy-package-json'], () => {
    const pkg = getPackageJson();

    return gulp.src('./build/server/**/*.pug')
        .pipe(replace(/(\.js|\.css)(\s*'\s*)/g, `$1?v=${pkg.version}'`))
        .pipe(gulp.dest('./build/server/'));
});

gulp.task('zip', ['git-init', 'replace'], () => {
    const pkg = getPackageJson();
    const buildFileName = `${pkg.name}_${pkg.version}_${currentBranch}_node-${process.version}_${timestamp}.zip`;

    gutil.log(`Compressing to "dist\\${buildFileName}" ...`);
    return gulp.src('./build/**')
        .pipe(zip(buildFileName))
        .pipe(gulp.dest('./dist'));
});

gulp.task('ftp-upload', ['git-init'], () => {
    const conn = ftp.create({
        host: '12.70.252.178',
        user: 'development',
        password: '1q2w3e4r5t',
        log: gutil.log
    });
    const destinationDirectory= (currentBranch === 'release') ? '/EXA' : '/EXATesting';

    return gulp.src(['./dist/**'], { base: './dist', buffer: false })
    //.pipe(conn.newer('/EXA/billing'))
        .pipe(conn.dest('/EXA'));
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
        });
        git.revParse({ args: '--short HEAD'}, function (err, commit) {
            currentCommit = commit;
        });
        done();
    });
});

gulp.task('git-add', ['git-init'], () => {
    return gulp.src('./package.json')
        .pipe(git.add());
});

gulp.task('git-commit', ['git-add'], () => {
    const pkg = getPackageJson();

    return gulp.src('./package.json')
        .pipe(git.commit(`Build v${pkg.version}`));
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
    'check-build-environment',
    'clean',
    'copy',
    'requirejsBuild',
    'bump',
    'replace',
    'zip',
    'clean-all',
]);

gulp.task('deploy', (done) => {
    runSequence('git-pull', 'build', 'git-commit', 'git-push', 'ftp-upload', done);
});

gulp.task('build-from-repo', (done) => {
    runSequence('git-pull', 'build', 'git-commit', 'git-push', done);
});


gulp.task('default', ['requirejsBuild'], () => {
    //gutil.log('done');
});
