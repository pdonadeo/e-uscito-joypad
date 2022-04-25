#!/bin/bash

dune clean
pushd frontend
rm -Rf build
yarn build
popd
rm -Rf assets && mkdir assets
cp -a frontend/public/* assets/
mkdir assets/js
cp -a frontend/build/static/js/* assets/js/
dune build @install
