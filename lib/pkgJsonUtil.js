#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var log = console.log;

function getDependencies(pkgJson) {
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
        return [];
    }

    Object.keys(dependencies).forEach(function (dependency) {
        // Bare bones prune for git or http dependencies
        if (dependencies[dependency].indexOf("http") > -1 || dependencies[dependency].indexOf("git") > -1) {
            log('Pruned ' + dependency + ' from the dependency check. Dep-rep does not support http(s):// or git:// yet.');
            delete dependencies[dependency];
        }
    });

    return dependencies;
}

module.exports = {
    getDependencies: getDependencies
};