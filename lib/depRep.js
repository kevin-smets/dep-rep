#!/usr/bin/env node
'use strict';

var assert = require('assert');
var chalk = require('chalk');
var https = require('https');
var log = console.log;
var npm = require('npm');
var path = require('path');
var ProgressBar = require('progress');
var Promise = require('promise');
var semver = require('semver');
var semverDiff = require('semver-diff');
var table = require('text-table');
var toExact = require('to-exact-semver');

var pkgJsonUtil = require('./pkgJsonUtil');

var PROTOCOL_HTTPS = "https://";

var bar;
var updateReport = {};

function colorizeDiff(diff) {
    switch (diff) {
        case 'major':
            return chalk.red("Major");
        case 'minor':
            return chalk.yellow("Minor");
        case 'patch':
            return chalk.white("Patch");
        default:
            return diff;
    }
}

/**
 * Fetches the latest version of the package from the registry
 *
 * @param packageName
 * @returns {Promise}
 */
function getLatestVersion(packageName) {
    return new Promise(function (resolve, reject) {
        var spawn = require('child_process').spawn;
        var npm = spawn('npm', ['view', packageName, 'dist-tags', '--json']);

        npm.stdout.on('data', function (data) {
            if (bar) bar.tick();
            resolve(JSON.parse(data).latest);
        });

        npm.stderr.on('data', function (err) {
            log(chalk.red("Something went wrong") + " when determining the latest version of " + chalk.cyan(packageName));
            if (bar) bar.tick();
            reject(err);
        });
    })
}

/**
 * Bundles the update statuses of all given packages
 *
 * @param packages
 * @returns {Promise}
 */
function getLatestVersions(packages) {
    var promises = [];

    Object.keys(packages).forEach(function (packageName) {
        var currentSemVer = (packages[packageName]);
        var versionPromise = getLatestVersion(packageName);

        versionPromise
            .then(function (latestSemVer) {
                var pkgObject = {
                    name: packageName,
                    from: currentSemVer,
                    to: latestSemVer,
                    satisfied: semver.satisfies(latestSemVer, currentSemVer)
                };
                // Add the diff status if dependency no longer includes the latest version
                if (!pkgObject.satisfied) {
                    try {
                        pkgObject.diff = semverDiff(toExact(currentSemVer), latestSemVer);
                    }
                    catch (err) {
                        pkgObject.diff = "Out of range"
                    }
                }

                updateReport[packageName] = pkgObject;
            })
            .catch(function (err) {
                log(err);
            });

        promises.push(versionPromise);
    });

    return Promise.all(promises);
}

/**
 * dep-rep executor, creates a report of the package update statuses.
 *
 * @param options
 * @param pkgJson
 * @returns {Promise}
 */
function exec(options, pkgJson) {
    var dependencies = pkgJsonUtil.getDependencies(pkgJson);

    if (dependencies.length < 1) {
        return reject("No supported dependencies found in the package.json.");
    }

    if (!options.silent) {
        log();
        bar = new ProgressBar('Fetching latest versions [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: Object.keys(dependencies).length
        });
    }

    return getLatestVersions(dependencies)
}

/**
 * Sets up the necessary config for dep-rep to do it's work
 *
 * @param options (CLI options)
 * @returns {Promise}
 */
function analyze(options) {
    updateReport = {};
    options = options || {};

    // When not coming through CLI, default silent to true
    if (typeof options.silent === "undefined") {
        options.silent = true;
    }

    var pkgJson;

    return new Promise(function (resolve, reject) {
        function resolveWrap() {
            if (!options.silent) report(updateReport);
            resolve(updateReport);
        }

        // Remote package.json (https://)
        if (options.p && options.p.indexOf(PROTOCOL_HTTPS) == 0) {
            https.get(options.p, function (res) {
                res.on('data', function (data) {
                    exec(options, JSON.parse(data))
                        .then(resolveWrap)
                        .catch(reject);
                });
            });
        } else {
            // Local json
            if (options && options.p) {
                pkgJson = require(path.resolve(options.p));
            } else {
                pkgJson = require(path.join(process.cwd(), 'package.json'));
            }
            exec(options, pkgJson)
                .then(resolveWrap)
                .catch(reject);
        }
    })
}

/**
 * Writes the report to the console
 *
 * @param result
 */
function report(result) {
    var tbl = [];
    var satisfied = [];
    var unsatisfied = [];

    Object.keys(result)
        .sort()
        .forEach(function (packageName) {
            var pkg = result[packageName];

            pkg.name = packageName;

            if (pkg.satisfied) {
                satisfied.push(pkg);
            } else {
                unsatisfied.push(pkg);
            }
        });

    var header = [];
    header.push(
        chalk.white("Name"),
        chalk.white("Local"),
        chalk.white("Remote"),
        chalk.white("Updates"));

    tbl.push(header, []);

    if (satisfied.length > 0) {
        log(); // otherwise it ends up after the progress bar

        satisfied.forEach(function (pkg) {
            var row = [];
            row.push(
                chalk.white(pkg.name),
                chalk.grey(pkg.from),
                chalk.grey(pkg.to),
                chalk.green("Up to date"));

            tbl.push(row);
        });
    }

    if (unsatisfied.length > 0) {
        unsatisfied.forEach(function (pkg) {
            var row = [];

            row.push(
                chalk.white(pkg.name),
                chalk.grey(pkg.from),
                chalk.green(pkg.to),
                colorizeDiff(pkg.diff));

            tbl.push(row);
        });

        log(table(tbl, {align: ['l', 'r', 'r', 'l']}));
    } else {
        log(table(tbl, {align: ['l', 'r', 'r', 'l']}));
        log(chalk.green("\nAll your dependencies are up to date ") + chalk.white(":") + chalk.red("o") + chalk.white(")"))
    }
    log();
}

module.exports = {
    analyze: analyze
};
