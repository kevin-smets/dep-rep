#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const npm = require('npm');
const path = require('path');
const semver = require('semver');
const semverDiff = require('semver-diff');

const LOG_PREFIX = "%log-prefix%";

var pkgJson;

function log(message) {
    console.log(LOG_PREFIX + message)
}

function hook() {
    var old_write = process.stdout.write;

    process.stdout.write = (function (write) {
        return function (string, encoding, fd) {
            if (string.startsWith(LOG_PREFIX)) {
                arguments[0] = string.replace(LOG_PREFIX, "");
                write.apply(process.stdout, arguments);
            }
        }
    })(process.stdout.write);

    return function () {
        process.stdout.write = old_write
    }
};

function getLatestVersion(packageName) {
    return new Promise(function (resolve, reject) {
        npm.load({silent: true}, function (err) {
            if (err) reject(err);

            npm.commands.info([packageName], function (er, data) {
                resolve(Object.keys(data)[0]);
            });
        });
    })
}

function getLatestVersions(packages) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        var updateReport = {
            satisfied: [],
            unsatisfied: []
        };

        Object.keys(packages).forEach(function (pkg) {
            var currentSemVer = (packages[pkg]);
            var versionPromise = getLatestVersion(pkg);

            versionPromise.then(function (latestSemVer) {
                if (semver.satisfies(latestSemVer, currentSemVer)) {
                    updateReport.satisfied.push({
                        name: pkg,
                        from: currentSemVer,
                        to: latestSemVer,
                        status: 'satisfies'
                    });
                }
                var diff = semverDiff(currentSemVer, latestSemVer);
                if (diff) {
                    updateReport.unsatisfied.push({
                        name: pkg,
                        from: currentSemVer,
                        to: latestSemVer,
                        status: diff
                    });
                }
            });

            promises.push(versionPromise);
        });

        Promise.all(promises)
            .then(function () {
                //log(JSON.stringify(updateReport));
                resolve(updateReport);
            })
            .catch(function (err) {
                reject(err);
            });
    })
}

function exec(logToConsole) {
    return new Promise(function (resolve, reject) {
        var dependencies = Object.assign(
            pkgJson.dependencies,
            pkgJson.devDependencies,
            pkgJson.optionalDependencies,
            pkgJson.peerDependencies
        );

        var unhook = hook();

        getLatestVersions(dependencies)
            .then(function (result) {
                unhook();
                if (logToConsole) report(result);
                resolve(result);
            })
            .catch(reject(function (err) {
                reject(err);
            }));
    })
}

function analyze(pathToPackage, logToConsole) {
    pkgJson = require(path.resolve(process.cwd(), pathToPackage || 'package.json'));

    return(exec(logToConsole));
}

function report(result){
    result.satisfied.forEach(function(pkg) {
        console.log(chalk.white(pkg.name) + " " + pkg.from + chalk.green(" includes the latest version ") + pkg.to)
    });

    result.unsatisfied.forEach(function(pkg) {
        console.log(chalk.white(pkg.name) + " " + pkg.from + chalk.yellow(" can be updated to ") + pkg.to + " (" + pkg.status + ")")
    });
}

module.exports = {
    analyze: analyze
};
