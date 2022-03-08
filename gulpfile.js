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
const argv = require("yargs").argv

const package_json = path.join(path.dirname(__filename),'package.json');
const pkg = JSON.parse(fs.readFileSync(package_json));
const version = semver.parse(pkg.version).version;

// For command-line parsing
const gitTag = parseGitTag();

// Map to hold Git info from Git tag
const gitTagInfoMap = new Map();

const build_version = [gitTag, version, getTagDate()].join('_');
const build_file_name = `${pkg.name}_${build_version}.zip`;

function parseGitTag() {
  var gitTag = process.env.GIT_TAG || argv.gitTag;
  if(gitTag == undefined) {
    var branch = getBranch();
    gitTag = branch.replace("/", "-");
  }
  return gitTag;
}

function getTagDate() {
  getGitInfoFromGitTag();
  return gitTagInfoMap.get("date");
}

function getGitInfoFromGitTag() {
    const { execSync } = require('child_process');

    var tag = gitTag;
    // We don't expect a tag to have any of these key words,
    // so if it has it, just treat as the HEAD of the branch.
    if (tag.includes("development") || tag.includes("feature") ||
        tag.includes("release")) {
      tag = "HEAD";
    }
    // Git date/time
    var cmd = execSync("git log -1 --format=%ai "+tag);
    const gitLog = `${cmd}`.trim();
    // gitLog has "2022-01-24 12:43:18 -0500" format
    var date = gitLog.split(" ")[0].replace(/-/g, "");
    var time = gitLog.split(" ")[1].split(":");
    time = time[0]+time[1];
    gitTagInfoMap.set("date", [date, time].join("."));

    // Git hash
    var cmd = execSync("git log -1 --format=%h "+tag);
    const gitHash = `${cmd}`.trim();
    gitTagInfoMap.set("hash", gitHash);
}

function getBranch() {
    const {execSync} = require('child_process');
    const branch = execSync('git rev-parse --abbrev-ref HEAD');
    return `${branch}`.trim();
}

const less = parallel(less_default, less_dark, less_chat);
exports.less = less;
exports.clean = clean;
exports.default = exports.build = series(check_build_environment, clean, copy, npm_ci, less,
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
    return src(['./build', './dist', 'app/node_modules'], { allowEmpty: true }).pipe(gulp_clean());
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

function less_chat () {
    return src([ './app/js/modules/multichat/stylesheets/chat.less' ])
        .pipe(gulp_less({ paths: [ path.join(__dirname, 'app/js/modules/multichat/stylesheets/chat.less') ] }))
        .pipe(dest('./build/app/js/modules/multichat/stylesheets'));
}

function requirejsBuild(cb) {
    const { rjsConfig } = require('./build/app/js/main');
    const requirejsConfig = {
        ...rjsConfig,
        name: 'main',
        baseUrl: './build/app/js',
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

function bumpMajorVersion(cb) {
  src(['./package*.json'])
    .pipe(gulp_bump({type:'major'}))
    .pipe(dest('./'));
  cb();
}
exports.bumpMajorVersion = bumpMajorVersion

function bumpMinorVersion(cb) {
  src(['./package*.json'])
    .pipe(gulp_bump({type:'minor'}))
    .pipe(dest('./'));
  cb();
}
exports.bumpMinorVersion = bumpMinorVersion

function bumpPatchVersion(cb) {
  src(['./package*.json'])
    .pipe(gulp_bump({type:'patch'}))
    .pipe(dest('./'));
  cb();
}
exports.bumpPatchVersion = bumpPatchVersion

function printVersion(cb) {
  console.log(build_version);
  cb();
}
exports.printVersion = printVersion

function printArtifactName(cb) {
  console.log(build_file_name);
  cb();
}
exports.printArtifactName = printArtifactName
