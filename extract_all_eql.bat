@echo off
set GAMEID=eql
rem set ASSETPATH="E:\Games\Landmark Beta\Resources\Assets"
set ASSETPATH="E:\Games\LM_Beta\Resources\Assets"
rem set ASSETPATH="E:\Games\EverQuest Next Landmark\Resources\Assets"

for /f "delims=" %%a in ('external\date.exe +%%Y%%m%%d_%%H%%M%%S') do @set timestamp=%%a
mkdir assets\%GAMEID%\all_%timestamp%
node packer.js extractall %ASSETPATH% assets\%GAMEID%\all_%timestamp%
pause