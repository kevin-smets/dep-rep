#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const npm = require('npm');
const path = require('path');
const semver = require('semver');
const semverDiff = require('semver-diff');

const LOG_PREFIX = "%log-prefix%";

var pkgJson;

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
            if (string.startsWith(LOG_PREFIX)) {
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
        npm.load({silent: true}, function (err) {
            if (err) reject(err);

            npm.commands.info([packageName], function (er, data) {
                try {
                    resolve(Object.keys(data)[0])
                }
                catch (err) {
                    log(chalk.red("Something went wrong") + " when determining the latest version of " + chalk.cyan(packageName));
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
 * @returns {Promise}
 */
function getLatestVersions(packages) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        var updateReport = {};

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
                            pkgObject.diff = "unsatisfied"
                        }

                    }

                    updateReport[packageName] = pkgObject;
                })
                .catch(function (err) {
                    log(err);
                });

            promises.push(versionPromise);
        });

        Promise.all(promises)
            .then(function () {
                resolve(updateReport);
            })
            .catch(function (err) {
                reject(err);
            });
    })
}

/**
 * dep-rep executor, creates a report of the package update statuses.
 *
 * @param options
 * @returns {Promise}
 */
function exec(options) {
    options = options || {};

    if (typeof options.silent === "undefined") {
        options.silent = true;
    }

    return new Promise(function (resolve, reject) {
        var dependencies = Object.assign(
            {},
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

        Object.keys(dependencies).forEach(function (dependency) {
            // Bare bones prune for git or http dependencies
            if (dependencies[dependency].indexOf("http") > -1 || dependencies[dependency].indexOf("git") > -1) {
                delete dependencies[dependency];
            }
        });

        var unhook = hook();

        getLatestVersions(dependencies)
            .then(function (result) {
                unhook();
                if (!options.silent) report(result);
                resolve(result);
            })
            .catch(reject(function (err) {
                reject(err);
            }));
    })
}

/**
 * Sets up the necessary config for dep-rep to do it's work
 *
 * @param pathToPackage
 * @param logToConsole
 * @returns {Promise}
 */
function analyze(options) {
    pkgJson = require(path.resolve(process.cwd(), options.p || 'package.json'));

    return (exec(options));
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
        console.log("\nSatisfied dependencies");
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
