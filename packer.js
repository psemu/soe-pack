#!/usr/bin/env node
var path = require("path");
var packer = require("./soe-pack.js");

var mode = process.argv[2];
var excludeFiles = ["Assets_256.pack"];

switch (mode) {
    case "pack": 
        var inPath = process.argv[3],
            outPath = process.argv[4];
        if (!outPath) {
            outPath = "Assets_" + Date.now() + ".pack";
        }
        packer.pack(inPath, outPath);
        break;
    case "manifest": 
        var inPath = process.argv[3],
            outFile = process.argv[4];
        if (!outFile) {
            outFile = "manifest_" + Date.now() + ".txt";
        }
        packer.manifest(inPath, outFile, excludeFiles);
        break;
    case "diff": 
        var oldManifest = process.argv[3],
            newManifest = process.argv[4],
            outFile = process.argv[5];
        if (!outFile) {
            outFile = "diff_" + Date.now() + ".json";
        }
        packer.diff(oldManifest, newManifest, outFile);
        break;
    case "extractall": 
        var inPath = process.argv[3],
            outPath = process.argv[4];
        packer.extractAll(inPath, outPath, excludeFiles);
        break;
    case "extractdiff": 
        var diffPath = process.argv[3],
            packPath = process.argv[4],
            outPath = process.argv[5];
        packer.extractDiff(diffPath, packPath, outPath, excludeFiles);
        break;
    case "extract": 
        var inPath = process.argv[3],
            file = process.argv[4];
        packer.extractFile(inPath, file, excludeFiles);
        break;
    case "append": 
        var inFile1 = process.argv[3],
            inFile2 = process.argv[4],
            outFile = process.argv[5];
        packer.append(inFile1, inFile2, outFile);
        break;
    default:
        console.log("Usage: node packer.js <mode> ...");
}

