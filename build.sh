#!/bin/bash

mkdir -p dist

babel src -o dist/pr.js --minified --no-babelrc --no-comments --presets=env
