@echo off

rem Drag a .pack file on this .bat to extract the assets in the pack

set pack=%1
set outpath=%pack:.pack=%

mkdir %outpath%
node .\packer.js extractpack %pack% %outpath%
pause