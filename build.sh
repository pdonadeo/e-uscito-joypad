#!/bin/bash

dune clean
pushd frontend
rm -Rf build
yarn build
popd
rm -Rf assets && mkdir assets
cp -a frontend/public/* assets/
mkdir assets/js assets/css
cp -a frontend/build/static/js/* assets/js/
cp -a frontend/build/static/css/* assets/css/
dune build @install
