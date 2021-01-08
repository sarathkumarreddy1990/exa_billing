const {dest, parallel, series, src } = require('gulp');
const chmod = require('gulp-chmod');
const exec = require('gulp-exec');
const fs = require('fs');
const gulp_bump = require('gulp-bump');
const gulp_clean = require('gulp-clean');
const gulp_less = require('gulp-less');
const gulp_uglify = require('gulp-uglify');
const gulp_zip = require('gulp-zip');
const moment = require('moment-timezone');
const path = require('path');
const requirejs = require('requirejs');
const semver = require('semver');

const package_json = path.join(path.dirname(__filename),'package.json');
const pkg = JSON.parse(fs.readFileSync(package_json));
const version = semver.parse(pkg.version);
const build_version = get_build_version(version.version);
const build_file_name = `${pkg.name}_${build_version}.zip`;

// TODO: This belongs in an npm registry for us to reuse across all projects
function get_build_version(version) {
    const build_meta = [
        process.env.BUILD_TAG,
        process.env.GIT_BRANCH || get_branch(),
        `node-${process.version}`,
        moment().tz(process.env.TZ || 'UTC').format('YYYYMMDDHHmm'),
    ]
          .filter(x => !!x)
          .map(x => x.replace(/\r?\n|\r/g, ''))
	  .map(x => decodeURIComponent(x)).map(x => x.replace(/[^0-9A-Za-z.-]/g, '-'))
	  .join('.');
    const build_version = [version, build_meta].filter(x => !!x).join('+');
    if (!semver.valid(build_version)) {
        throw new Error(`Cannot parse build_version ${build_version}`);
    }
    return build_version;
}

function get_branch() {
    const {execSync} = require('child_process');
    const branch = execSync('git rev-parse --abbrev-ref HEAD');
    return `${branch}`;
}

const less = parallel(less_default, less_dark);
exports.less = less;
exports.clean = clean;
exports.default = exports.build = series(check_build_environment, clean, copy, bump, npm_ci, less,
                                         requirejsBuild, compress, zip
                                        );
// Drops clean all make sure it's covered in clean

function check_build_environment(cb) {
    // Good practice have pkg.engines.node at lowest version for named lts *UNLESS* a specific feature or bugfix is *REQUIRED*
    if (!semver.satisfies(process.version, pkg.engines.node)) {
        cb(new Error(`Nodejs ${process.version} does not satisfy ${pkg.engines.node}`));
        return;
    }
    if (!semver.satisfies(process.version, '>=8.12.0')) {
        cb(new Error(`Nodejs ${process.version} must be >= 8.12.0 to provide npm >= 6.4.1 for 'npm ci'`))
        return;
    }
    cb();
}

function clean() {
    return src(['./build', './dist'], { allowEmpty: true }).pipe(gulp_clean());
}

function copy() {
    return src(['./**', '!./build{,//*}', '!./dist{,/**}', '!./**/node_modules{,/**}']).pipe(dest('./build'));
}

function bump() {
    return src(['./build/**/package*.json']).pipe(gulp_bump({version: build_version}));
}

const execOptions = {
    continueOnError: false,
    pipeStdout: false
};
const execReportOptions = {
    err: true,
    stderr: true,
    stdout: true
};

function npm_ci() {
    return src(['./build/**/package.json', '!./**/node_modules/**/package.json'])
        .pipe(exec(file => `echo ${file.dirname} && cd ${file.dirname} && npm ci --only=production && echo ${file.dirname} $?`, execOptions))
        .pipe(exec.reporter(execReportOptions));
}

function less_default() {
    return src(['./app/skins/default/*.less'])
        .pipe(gulp_less({paths: [path.join(__dirname, 'app/skins/default/index.less')]}))
        .pipe(dest('./build/app/skins/default'));
}

function less_dark() {
    return src(['./app/skins/dark/*.less'])
        .pipe(gulp_less({paths: [path.join(__dirname, 'app/skins/dark/index.less')]}))
        .pipe(dest('./build/app/skins/dark'))
}

function requirejsBuild(cb) {
    const { rjsConfig } = require('./app/js/main');
    const requirejsConfig = {
        ...rjsConfig,
        name: 'main',
        baseUrl: './app/js',
        out: './build/app/js/main.js',
        optimize: 'uglify2',
        preserveLicenseComments: false,
        waitSeconds: 0,
        wrap: true,
        optimizeCss: "none", //standard","
        generateSourceMaps: false,
        uglify2: {
            mangle: false,
            codegen: {
                ascii_only: true
            }
        }
    };

    requirejs.optimize(requirejsConfig, function () {
        cb()
    }, function (error) {
        console.error('requirejs task failed', error);
        throw error;
    });
}

function compress() {
    return src(['./build/app/js/main.js']).pipe(gulp_uglify()).pipe(dest('./build/app/js'));
}

function zip() {
    return src(['./build/**']).pipe(chmod(undefined, 0o40755)).pipe(gulp_zip(build_file_name)).pipe(dest('./dist'));
}
