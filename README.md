soe-pack
=====

A library and utility for accessing SOE pack files

Building
=====

    npm install

Edit paths in batch scripts to match your own setup.

Running
=====

Create manifest and diffs for game (e.g. PS2 test, PS2 live, EQL):

    update_test.bat
    update_live.bat
    update_eql.bat

Manifest and diff files are placed in "manifests/[gameid]/".


Extract all added and modified assets from latest diff:

    extract_diff_test.bat
    extract_diff_test.bat
    extract_diff_test.bat

Assets are extracted to "assets/[gameid]/".