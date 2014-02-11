@echo off
set GAMEID=eql
set ASSETPATH="C:\Users\Public\Sony Online Entertainment\Installed Games\EverQuest Next Landmark\Resources\Assets"

for /f "delims=" %%a in ('external\date.exe +%%Y%%m%%d_%%H%%M%%S') do @set timestamp=%%a
mkdir assets\%GAMEID%\all_%timestamp%
node packer.js extractall %ASSETPATH% assets\%GAMEID%\all_%timestamp%
pause