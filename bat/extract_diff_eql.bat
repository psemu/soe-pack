@echo off
set GAMEID=eql
rem set ASSETPATH="E:\Games\Landmark Beta\Resources\Assets"
set ASSETPATH="E:\Games\LM_Beta\Resources\Assets"

for /f "delims=" %%a in ('external\date.exe +%%Y%%m%%d_%%H%%M%%S') do @set timestamp=%%a
mkdir assets\%GAMEID%\%timestamp%
node packer.js extractdiff manifests\%GAMEID%\diff_latest.json %ASSETPATH% assets\%GAMEID%\%timestamp%
pause