@echo off
set GAMEID=daum
set ASSETPATH="E:\Games\Planetside 2 Daum\Resources\Assets"
node packer.js extractregexp %ASSETPATH% %1 assets\%GAMEID%
