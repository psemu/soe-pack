echo off
cls
call browserify -f path -r buffer -r jenkins-hash -r soe-pack  > bundle.js