#!/usr/bin/env node
'use strict';

// 3rd party deps
const argv = require('yargs').argv;
const diff = require('jiff').diff;
const fs = require('fs-extra');
const ncu = require('npm-check-updates');
const path = require('path');

const semverDiff = require('semver-diff');

// Static config
const pkgJson = path.join(process.cwd(), 'package.json');

// Default ncu config
var ncuConfig = {
    packageFile: pkgJson,
    jsonAll: true
};

// CLI params
if (argv.b || argv.bower) {
    ncuConfig.packageManager = "bower"
}

function compare(oldJson, newJson) {
    var pkgPatch = diff(oldJson, newJson);

    var pkgReport = {};

    for (var i = 0; i < pkgPatch.length; i++) {
        var from = pkgPatch[i];
        var to = pkgPatch[++i];

        pkgReport[from.path] = {
            from: from.value,
            to: to.value,
            status: semverDiff(from.value, to.value)
        }
    }

    return pkgReport;
}

function report(oldJson, newJson) {
    return new Promise(function (resolve) {
        if (oldJson && newJson) {
            resolve(compare(oldJson, newJson))
        }

        ncu
            .run(ncuConfig)
            .then(function (upgraded) {

                var currentPackage = fs.readJsonSync(pkgJson);

                resolve(compare(currentPackage, upgraded));
            });
    });
}

module.exports = {
    report: report
};
