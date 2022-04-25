#!/bin/bash

echo -e 'open Tyxml\n' > $1
echo 'let%html react_build_index () = {|' >> $1
cat index.html >> $1
echo -e '\n|}' >> $1
