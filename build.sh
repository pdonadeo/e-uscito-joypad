#!/bin/bash


pushd frontend
rm -Rf build
yarn build
popd

dune clean && dune build @install
