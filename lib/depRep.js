#!/usr/bin/env node
'use strict';

var _ = require('lodash');
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

var PROTOCOL_HTTPS = "https://";

var bar;
var updateReport = {};

/**
 * Fetches the latest version of the package from the registry
 *
 * @param packageName
 * @returns {Promise}
 */
function getLatestVersion(packageName) {
    return new Promise(function (resolve, reject) {
        npm.load({}, function (err) {
            if (err) reject(err);

            var spawn = require('child_process').spawn;
            var npm = spawn('npm', ['view', packageName, 'dist-tags', '--json']);

            npm.stdout.on('data', function(data) {
                if (bar) bar.tick();
                resolve(JSON.parse(data).latest);
            });

            npm.stderr.on('data', function(err) {
                log(chalk.red("Something went wrong") + " when determining the latest version of " + chalk.cyan(packageName));
                if (bar) bar.tick();
                reject(err);
            });
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
                        pkgObject.diff = semverDiff(currentSemVer, latestSemVer);
                    }
                    catch (err) {
                        pkgObject.diff = "out of range"
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
    var dependencies = _.merge(
        {},
        pkgJson.bundleDependencies,
        pkgJson.bundledDependencies,
        pkgJson.dependencies,
        pkgJson.devDependencies,
        pkgJson.optionalDependencies,
        pkgJson.peerDependencies
    );

    // No dependencies defined?
    if (dependencies === {}) {
        console.log("No deps, no dice! No dependencies were found in the given package.json");
        return reject("No deps, no dice!");
    }

    if (!options.silent) {
        console.log();
        bar = new ProgressBar('Fetching latest versions [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: Object.keys(dependencies).length
        });
    }

    Object.keys(dependencies).forEach(function (dependency) {
        // Bare bones prune for git or http dependencies
        if (dependencies[dependency].indexOf("http") > -1 || dependencies[dependency].indexOf("git") > -1) {
            delete dependencies[dependency];
        }
    });

    return getLatestVersions(dependencies)
}

/**
 * Sets up the necessary config for dep-rep to do it's work
 *
 * @param options (CLI options)
 * @returns {Promise}
 */
function analyze(options) {
    options = options || {};

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
            pkgJson = require(path.resolve(process.cwd(), options.p || 'package.json'));
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
        chalk.white("Status"));

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

            semverDiff(pkg.from, pkg.to);
            row.push(
                chalk.white(pkg.name),
                chalk.grey(pkg.from),
                chalk.green(pkg.to),
                chalk.yellow("Outdated"));

            tbl.push(row);
        });

        console.log(table(tbl, {align: ['l', 'r', 'r', 'l']}));
    } else {
        console.log(table(tbl, {align: ['l', 'r', 'r', 'l']}));
        console.log(chalk.green("\nAll your dependencies are up to date ") + chalk.white(":") + chalk.red("o") + chalk.white(")"))
    }
    console.log();
}

module.exports = {
    analyze: analyze
};
