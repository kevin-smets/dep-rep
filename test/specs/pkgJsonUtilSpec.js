#!/usr/bin/env node
'use strict';

const assert = require('assert');

const supported = require('../fixtures/supported.json');
const unsupported = require('../fixtures/unsupported.json');

const pkgJsonUtil = require('../../lib/pkgJsonUtil');

describe('pkgJsonUtil', function () {
    describe('#getDependencies()', function () {
        it('should not return unsupported dependencies', function () {
            var dependencies = pkgJsonUtil.getDependencies(unsupported);
            assert.equal(Object.keys(dependencies).length, 0);
        });
        
        it('should return supported entries', function () {
            var dependencies = pkgJsonUtil.getDependencies(supported);
            assert.equal(Object.keys(dependencies).length, 1);
        });
    });
});