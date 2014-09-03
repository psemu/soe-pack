@echo off
set GAMEID=test
set ASSETPATH="E:\Games\Planetside 2 Test\Resources\Assets"
node ..\packer.js extractregexp %ASSETPATH% %1 ..\assets\%GAMEID%
