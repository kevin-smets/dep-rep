#!/usr/bin/env node
'use strict';

var assert = require('assert');

var depRep = require('../../lib/depRep');

var oldJson = require('../fixtures/old.json');
var newJson = require('../fixtures/new.json');
var unsupported = require('../fixtures/unsupported.json');

function key(number, dev) {
    var prefix = "/dependencies/";

    if (dev) prefix = "/devDependencies/";

    return prefix + number;
}

describe('Compare', function () {
    // describe('#report()', function () {
    //     it('should generate a proper report for dependencies', function () {
    //         depRep
    //             .report(oldJson, newJson)
    //             .then(function () {
    //                 assert.equal(analyze[key(1)].status, "major");
    //                 assert.equal(report[key(2)].status, null);
    //                 assert.equal(report[key(3)], null);
    //                 assert.equal(report[key(4)].status, null);
    //                 assert.equal(report[key(5)].status, null);
    //                 assert.equal(report[key(6)], null);
    //                 assert.equal(report[key(7)].status, null);
    //                 assert.equal(report[key(8)].status, "minor");
    //                 assert.equal(report[key(9)].status, "major");
    //                 done();
    //             });
    //     });
    // });
    //
    // describe('#report()', function () {
    //     it('should generate a proper report for devDependencies', function () {
    //         depRep
    //             .report(oldJson, newJson)
    //             .then(function () {
    //                 assert.equal(report[key(1, true)].status, "major");
    //                 assert.equal(report[key(2, true)].status, null);
    //                 assert.equal(report[key(3, true)], null);
    //                 assert.equal(report[key(4, true)].status, null);
    //                 assert.equal(report[key(5, true)].status, null);
    //                 assert.equal(report[key(6, true)], null);
    //                 assert.equal(report[key(7, true)].status, null);
    //                 assert.equal(report[key(8, true)].status, "minor");
    //                 assert.equal(report[key(9, true)].status, "major");
    //                 done();
    //             });
    //     });
    // });
});