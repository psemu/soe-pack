@echo off
set EDITOR="C:\Program Files\Sublime Text 3\sublime_text.exe"

if "%1"=="" exit elseif "%2"=="" exit

for /f "delims=" %%a in ('..\external\date.exe +%%Y%%m%%d_%%H%%M%%S') do @set timestamp=%%a
set manifestpath=..\manifests\%1
set assetpath=%2
echo Moving 'latest' manifest to 'previous'
move %manifestpath%\manifest_latest.txt %manifestpath%\manifest_previous.txt
echo Moving 'latest' diff to 'previous'
move %manifestpath%\diff_latest.json %manifestpath%\diff_previous.json
echo Generating new manifest
node ..\packer.js manifest %assetpath% %manifestpath%\manifest_%timestamp%.txt
echo Copying new manifest to 'latest'
copy %manifestpath%\manifest_%timestamp%.txt %manifestpath%\manifest_latest.txt
echo Generating new diff from 'previous' to 'latest'
node ..\packer.js diff %manifestpath%\manifest_previous.txt %manifestpath%\manifest_latest.txt %manifestpath%\diff_%timestamp%.json
echo Copying new diff to 'latest'
copy %manifestpath%\diff_%timestamp%.json %manifestpath%\diff_latest.json
%EDITOR% %manifestpath%\diff_latest.json
pause