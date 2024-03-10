const { task, series, parallel, src, dest, watch, lastRun } = require("gulp");
const plumber = require("gulp-plumber");
const ejs = require("gulp-ejs");
const gulpSass = require("gulp-sass");
const dartSass = require("dart-sass");
const autoprefixer = require("autoprefixer");
const dependents = require("gulp-dependents");
const postCss = require("gulp-postcss");
const sourcemaps = require("gulp-sourcemaps");
const minificss = require("gulp-minify-css");
const rename = require("gulp-rename");
const newer = require("gulp-newer");
const imagemin = require("gulp-imagemin");
const rimraf = require("rimraf");
const ws = require("gulp-webserver");
const path = require('path'); 

// paths -----------------------------------------------------------
const paths = {
  src : {
    path : "./src"
  },
  dist : {
    path : "./dist"
  }
};

paths.src = {
  ...paths.src,
  images : paths.src.path + "/assets/images",
  fonts : paths.src.path + "/assets/fonts",
  js : paths.src.path + "/assets/js",
  css : paths.src.path + "/assets/css",
};

paths.dist = {
  ...paths.dist,
  images : paths.dist.path + "/assets/images",
  fonts : paths.dist.path + "/assets/fonts",
  js : paths.dist.path + "/assets/js",
  css : paths.dist.path + "/assets/css",
};

// error --------------------------------------------------------------
const onErrorHandler = (error) => console.log(error);  // plumber option (에러 발생 시 에러 로그 출력)

// task -------------------------------------------------------------

const clean = async (done) => {
  rimraf.sync(paths.dist.path);
  done();
};

// html task
const html = () => {
  return src(`${paths.src.path}/**/*.html`)
    .pipe(plumber({errorHandler:onErrorHandler}))  
    .pipe(ejs())
    .pipe(dest(paths.dist.path));
};

const js = async () => {
  return (
    src(`${paths.src.js}/**/*.js`)
      .pipe(plumber({errorHandler:onErrorHandler}))  
      .pipe(newer(paths.dist.js))                       // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
      .pipe(dest(paths.dist.js))
  );
};

// css task
const scss = async () => {
  //scss 옵션 정의
  const sass = gulpSass(dartSass);                      // ECMAScript 모듈(최신 Node.js 14 이상에서 지원됨)에서 사용하기 위해 선언
  const options = {
    scss : {
      outputStyle: "expanded",                          // 컴파일 스타일: nested(default), expanded, compact, compressed
      indentType: "space",                              // 들여쓰기 스타일: space(default), tab
      indentWidth: 2,                                   // 들여쓰기 칸 수 (Default : 2)
      precision: 8,                                     // 컴파일 된 CSS 의 소수점 자리수 (Type : Integer , Default : 5)
      sourceComments: true,                             // 주석 제거 여부 (Default : false)
      compiler: dartSass,                               // 컴파일 도구
    },
    postcss: [autoprefixer({
      overrideBrowserslist: 'last 2 versions',          // 최신 브라우저 기준 하위 2개의 버전까지 컴파일
    })]
  };

  return src(
    `${paths.src.css}/**/*.scss`,                       // 컴파일 대상 scss파일 찾기
    {since: lastRun(scss), allowEmpty: true}            // 변경된 파일에 대해서만 컴파일 진행
  )
  .pipe(plumber({errorHandler:onErrorHandler}))         // 에러 발생 시 gulp종료 방지 및 에러 핸들링
  // *.css 생성
  .pipe(dependents())                                   // 현재 스트림에 있는 파일에 종속되는 모든 파일을 추가
  .pipe(sourcemaps.init())                              // 소스맵 작성
  .pipe(sass(options.scss).on('error', sass.logError))  // scss 옵션 적용 및 에러 발생 시 watch가 멈추지 않도록 logError 설정
  .pipe(postCss(options.postcss))                       // 하위 브라우저 고려
  .pipe(sourcemaps.write())                             // 소스맵 적용
  .pipe(dest(paths.dist.css))                           // 컴파일 후 css파일이 생성될 목적지 설정
  // *.min.css 생성
  .pipe(minificss())                                    // 컴파일된 css 압축
  .pipe(rename({suffix: '.min'}))                       // 압축파일 *.min.css 생성
  .pipe(sourcemaps.write())                             // 소스맵 적용
  .pipe(dest(paths.dist.css));                          // 컴파일 후 css파일이 생성될 목적지 설정
};

// image task
const image = async () => {
  return src(`${paths.src.images}/**/*`, {allowEmpty: true})         // 최적화 이미지 대상
  .pipe(newer(paths.dist.images))                   // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
  .pipe(imagemin({verbose: true}))                // 이미지 최적화 ( 최적화 된 이미지의 정보 기록 옵션 적용 )
  .pipe(dest(paths.dist.images));              // 최적화 후 생성될 목적지 설정
};

const css = async () => {
  return src(`${paths.src.css}/**/*`, {allowEmpty: true})
    .pipe(newer(paths.dist.css))                   // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
    .pipe(dest(paths.dist.css))
};

const fonts = async () => {
  return src(`${paths.src.fonts}/**/*.*`, {allowEmpty: true})
    .pipe(newer(paths.dist.fonts))                   // 변경된 파일만 통과, 변경되지 않은 파일 건너뛰기
    .pipe(dest(paths.dist.fonts))
};

// webserver task
const webserver = async () => {
  return src(paths.dist.path)       // webserver를 실행 할 폴더 경로
  .pipe(
    ws({                                                // webserver 옵션 설정
      livereload: true,                              // 작업 중 파일 저장 시 브라우저 자동 새로고침 (기본 false)
      open: true                                        // Gulp 실행 시 자동으로 브라우저를 띄우고 localhost 서버 열기 (기본 false)
    })
  );
};

const watchWrapper = async (done) => {
  file_management(watch([`${paths.src.path}/**/*.html`, `${paths.src.path}/**/*.ejs`], html), paths.src.path, paths.dist.path);

  // sass watch
  file_management(watch(`${paths.src.css}/**/*`, series([css, scss])), paths.src.css, paths.dist.css);

  // js watch
  file_management(watch(paths.src.js + "/**/*", js), paths.src.js, paths.dist.js);

  // image watch
  file_management(watch(paths.src.images + "/**/*", image), paths.src.images, paths.dist.images);

  // fonts watch
  file_management(watch(paths.src.fonts + "/**/*", fonts), paths.src.fonts, paths.dist.fonts);

  done();
};

// watch - 파일 감시 및 삭제를 위한 함수
const file_management = (watcher_target, src_path, dist_path) => {
  watcher_target.on('unlink', (filepath) => {
    const filePathFromSrc = path.relative(path.resolve(src_path), filepath);
    const extension_type = filePathFromSrc.split('.')[filePathFromSrc.split('.').length-1];

    // scss 삭제 (min 파일까지 삭제)
    if (extension_type === 'scss' || extension_type === 'css') {
      rimraf.sync(dist_path, {
        filter: (file) => {
          return file.endsWith(".css");
        },
      });

      rimraf.sync(dist_path, {
        filter: (file) => {
          return file.endsWith(".scss");
        },
      });
    } else if (extension_type === 'js') { // js 삭제 (min 파일까지 삭제)
      rimraf.sync(dist_path, {
        filter: (file) => {
          return file.endsWith(".js");
        },
      });
    } else if (extension_type === 'html' || extension_type === 'ejs') { // njk(html) 삭제
      rimraf.sync(dist_path, {
        filter: (file) => {
          return file.endsWith(".html");
        },
      });
    } else { // 위 파일 외 삭제
      const destFilePath = path.resolve(dist_path, filePathFromSrc);
      rimraf.sync(destFilePath);
    }
  });
}

task("default", series([
  clean,
  js,
  image,
  fonts,
  css,
  scss,
  html,
  parallel(
    webserver,
    watchWrapper
  )
]));
