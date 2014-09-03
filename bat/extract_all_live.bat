@echo off
set GAMEID=live
set ASSETPATH="E:\Steam\steamapps\common\PlanetSide 2\Resources\Assets"

for /f "delims=" %%a in ('external\date.exe +%%Y%%m%%d_%%H%%M%%S') do @set timestamp=%%a
mkdir assets\%GAMEID%\all_%timestamp%
node packer.js extractall %ASSETPATH% assets\%GAMEID%\all_%timestamp%
pause