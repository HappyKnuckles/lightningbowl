#!/bin/sh
# Builds src/assets/opencv/opencv.js: OpenCV.js with WebAssembly SIMD, holding only the modules and
# functions the shot analysis calls (opencv_js.config.py). The npm builds have no SIMD and carry dnn,
# objdetect, photo and calib3d; this one is faster on every frame and a smaller download.
#
# Needs Docker and git. Takes about 10 minutes. Usage: sh scripts/opencv/build.sh
set -e

OPENCV_VERSION=4.12.0
EMSDK_IMAGE=emscripten/emsdk:3.1.64

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git clone --quiet --depth 1 --branch "$OPENCV_VERSION" https://github.com/opencv/opencv.git "$work/opencv"
cp "$here/opencv_js.config.py" "$work/"

docker run --rm -v "$work":/src -u "$(id -u):$(id -g)" -e HOME=/tmp "$EMSDK_IMAGE" sh -c '
  cd /src/opencv && python3 platforms/js/build_js.py /src/build --build_wasm --simd \
    --config /src/opencv_js.config.py \
    --cmake_option=-DBUILD_opencv_dnn=OFF --cmake_option=-DBUILD_opencv_photo=OFF \
    --cmake_option=-DBUILD_opencv_objdetect=OFF --cmake_option=-DBUILD_opencv_calib3d=OFF \
    --cmake_option=-DBUILD_TESTS=OFF --cmake_option=-DBUILD_PERF_TESTS=OFF --cmake_option=-DBUILD_EXAMPLES=OFF \
    --build_flags="-O3"'

mkdir -p "$root/src/assets/opencv"
cp "$work/build/bin/opencv.js" "$root/src/assets/opencv/opencv.js"
echo "wrote src/assets/opencv/opencv.js ($(wc -c < "$root/src/assets/opencv/opencv.js") bytes)"
