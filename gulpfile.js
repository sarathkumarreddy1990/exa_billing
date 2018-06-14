const gulp = require('gulp');
const clean = require('gulp-clean');
//const copy = require('gulp-copy');
const zip = require('gulp-zip');

gulp.task('clean', () => {
    return gulp.src(['./build', './dist'])
        .pipe(clean());
});

gulp.task('copy', ['clean'], () => {
    return gulp.src('./**')
        .pipe(gulp.dest('./build'));
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

gulp.task('build', [
    'clean',
    'copy',
    'zip',
    'clean-all'
]);


gulp.task('default', ['build'], () => {
    //console.log('done');
});
