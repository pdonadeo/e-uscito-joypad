#!/bin/bash

pushd frontend || exit
rm -Rf build
yarn build
popd || exit

dune clean && dune build @install
