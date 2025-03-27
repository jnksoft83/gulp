import gulp from "gulp";
import plumber from "gulp-plumber";
import ejs from "gulp-ejs";
import gulpSass from "gulp-sass";
import * as dartSass from "sass";
import autoprefixer from "autoprefixer";
import postcss from "gulp-postcss";
import minificss from "gulp-minify-css";
import rename from "gulp-rename";
import newer from "gulp-newer";
import browserSync from "browser-sync";
import tailwindcss from "tailwindcss";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const rimraf = require("rimraf");
const task = gulp.task;
const series = gulp.series;
const parallel = gulp.parallel;
const src = gulp.src;
const dest = gulp.dest;
const watch = gulp.watch;
const tailwindConfig = require("./tailwind.config.cjs"); // 명시적으로 로드
const bsConfig = require("./browser.sync.config.cjs");

// paths -----------------------------------------------------------
const paths = {
  src: {
    path: "./src",
  },
  dist: {
    path: "./dist",
  },
};

paths.src = {
  ...paths.src,
  images: paths.src.path + "/static/images",
  fonts: paths.src.path + "/static/fonts",
  js: paths.src.path + "/static/js",
  css: paths.src.path + "/static/css",
  lib: paths.src.path + "/static/lib",
};

paths.dist = {
  ...paths.dist,
  images: paths.dist.path + "/static/images",
  fonts: paths.dist.path + "/static/fonts",
  js: paths.dist.path + "/static/js",
  css: paths.dist.path + "/static/css",
  lib: paths.dist.path + "/static/lib",
};

// error --------------------------------------------------------------
const onErrorHandler = (error) => console.log(error); // plumber option (에러 발생 시 에러 로그 출력)

// task -------------------------------------------------------------
const clean = async (done) => {
  rimraf.sync(paths.dist.path);
  done();
};

const deleteDistFile = (filePath) => {
  const filePathFromSrc = path.relative(path.resolve(paths.src.path), filePath);
  const distFilePath = path.resolve(paths.dist.path, filePathFromSrc);

  rimraf.sync(distFilePath); // dist 폴더에서 해당 파일 삭제
};

// html task
const html = (done) => {
  src(`${paths.src.path}/**/*.html`)
    .pipe(plumber({ errorHandler: onErrorHandler }))
    .pipe(ejs())
    .pipe(dest(paths.dist.path))
    .pipe(browserSync.stream());

  done();
};

const serve = (done) => {
  browserSync.init(bsConfig); // 설정 파일을 사용해 BrowserSync 실행
  done();
};

const js = (done) => {
  src(`${paths.src.js}/**/*`)
    .pipe(plumber({ errorHandler: onErrorHandler }))
    .pipe(newer(paths.dist.js)) // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
    .pipe(dest(paths.dist.js))
    .pipe(browserSync.stream());
  done();
};

// css task
const scss = (done) => {
  const sass = gulpSass(dartSass);

  src(`${paths.src.css}/*.scss`, { allowEmpty: true })
    .pipe(plumber({ errorHandler: onErrorHandler }))
    .pipe(sass({ outputStyle: "expanded" }).on("error", sass.logError))
    .pipe(postcss([tailwindcss(tailwindConfig), autoprefixer()]))
    .pipe(dest(paths.dist.css))
    .pipe(minificss())
    .pipe(rename({ suffix: ".min" }))
    .pipe(dest(paths.dist.css))
    .pipe(browserSync.stream());
  done();
};

const css = (done) => {
  src(`${paths.src.css}/**/*.*`, { allowEmpty: true })
    .pipe(newer(paths.dist.css)) // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
    .pipe(dest(paths.dist.css));
  done();
};

// image task (development 모드에서 제외)
const image = (done) => {
  src(`${paths.src.images}/**/*`, { allowEmpty: true })
    .pipe(newer({ dest: paths.dist.images }))
    .pipe(dest(paths.dist.images));
  done();
};

const fonts = (done) => {
  src(`${paths.src.fonts}/**/*.*`, { allowEmpty: true })
    .pipe(newer({ dest: paths.dist.fonts }))
    .pipe(dest(paths.dist.fonts))
    .pipe(browserSync.stream());
  done();
};

const watchWrapper = async (done) => {
  const htmlWatcher = watch([`${paths.src.path}/**/*.html`, `${paths.src.path}/**/*.ejs`], series([html, scss]));
  const cssWatcher = watch(`${paths.src.css}/**/*.scss`, series([scss, css]));
  const jsWatcher = watch(paths.src.js + "/**/*", series([js]));
  const imageWatcher = watch(paths.src.images + "/**/*", series([image]));
  const fontsWatcher = watch(paths.src.fonts + "/**/*", series([fonts]));

  // 파일 삭제 시 dist 폴더에서 해당 파일도 삭제
  htmlWatcher.on('unlink', deleteDistFile);
  cssWatcher.on('unlink', deleteDistFile);
  jsWatcher.on('unlink', deleteDistFile);
  imageWatcher.on('unlink', deleteDistFile);
  fontsWatcher.on('unlink', deleteDistFile);

  done();
};

// task 실행
task("default", series(clean, parallel(js, fonts, css, scss, html), image, serve, watchWrapper));