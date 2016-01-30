#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var chalk = require('chalk');
var https = require('https');
var npm = require('npm');
var path = require('path');
var ProgressBar = require('progress');
var Promise = require('promise');
var semver = require('semver');
var semverDiff = require('semver-diff');

var LOG_PREFIX = "%log-prefix%";
var PROTOCOL_HTTPS = "https://";

var bar;
var updateReport = {};

/**
 * console.log wrapper, these logs will pass through the overwritten stdout.write
 *
 * @param message
 */
function log(message) {
    console.log(LOG_PREFIX + message)
}

/**
 * Overwrite the standard stdout.write, to silence npm
 *
 * @returns {Function}
 */
function hook() {
    var old_write = process.stdout.write;

    process.stdout.write = (function (write) {
        return function (string, encoding, fd) {
            if (string.indexOf(LOG_PREFIX) == 0) {
                arguments[0] = string.replace(LOG_PREFIX, "");
                write.apply(process.stdout, arguments);
            }
        }
    })(process.stdout.write);

    return function () {
        process.stdout.write = old_write
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
        npm.load({}, function (err) {
            if (err) reject(err);

            npm.commands.view([packageName, 'dist-tags'], true, function (er, data) {
                try {
                    if (bar) bar.tick();
                    resolve(Object.keys(data)[0])
                }
                catch (err) {
                    log(chalk.red("Something went wrong") + " when determining the latest version of " + chalk.cyan(packageName));
                    if (bar) bar.tick();
                    reject(err);
                }
            });
        });
    })
}

/**
 * Bundles the update statuses of all given packages
 *
 * @param packages
 * @param options
 * @returns {Promise}
 */
function getLatestVersions(packages) {
    var promises = [];

    Object.keys(packages).forEach(function (packageName) {
        var currentSemVer = (packages[packageName]);
        var versionPromise = getLatestVersion(packageName);

        versionPromise
            .then(function (latestSemVer) {
                console.log(packageName);
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
        var unhook = hook();

        function resolveWrap() {
            unhook();
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

    if (satisfied.length > 0) {
        console.log("\n\nSatisfied dependencies");
        console.log("========================\n");

        satisfied.forEach(function (pkg) {
            console.log(chalk.white(pkg.name) + " " + pkg.from + chalk.green(" includes the latest version ") + pkg.to)
        });
    }

    if (unsatisfied.length > 0) {
        console.log("\nUnsatisfied dependencies");
        console.log("========================\n");

        unsatisfied.forEach(function (pkg) {
            console.log(chalk.white(pkg.name) + " " + pkg.from + chalk.yellow(" can be updated to ") + pkg.to + " (" + pkg.diff + ")")
        });
        console.log();
    } else {
        console.log(chalk.green("\nAll your dependencies are up to date ") + chalk.white(":") + chalk.red("o") + chalk.white(")\n"))
    }
}

module.exports = {
    analyze: analyze
};
