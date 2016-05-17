# dep-rep

[![Build Status](https://travis-ci.org/kevin-smets/dep-rep.svg?branch=master)](https://travis-ci.org/kevin-smets/dep-rep) [![Dependency Status](https://david-dm.org/kevin-smets/dep-rep.svg)](https://david-dm.org/kevin-smets/dep-rep) [![devDependency Status](https://david-dm.org/kevin-smets/dep-rep/dev-status.svg)](https://david-dm.org/kevin-smets/dep-rep#info=devDependencies)

Dependency reporter for npm

## Get started

### CLI usage

```
npm i -g dep-rep
```

From then on, you can run `dep-rep` in any folder containing a `package.json`.

Check `dep-rep -h` for more CLI options.

### Path declaration

-p or --path can be a local or a remote (https) path to a package.json, e.g.

**Local:**

```bash
dep-rep -p="../dep-rep/package.json"

# or

dep-rep -p="/Users/user/dev/dep-rep/package.json"
```

**Remote:**

```bash
dep-rep -p="https://raw.githubusercontent.com/kevin-smets/dep-rep/master/package.json"
```

### Output example

Output will look like this:

![Image of CLI output](assets/report.png)

Or, if everything is fine:

![Image of CLI output](assets/report-ok.png)

### Node usage

```
npm i -D dep-rep
```

```javascript
const depRep = require('dep-rep');

depRep.analyze(options)
  .then(function(result){
    console.log(result);
  })
  .catch(function(err){
    console.log("Ruh Roh: " + err);
  })
```

`options` is an object that takes the same properties as the CLI parameters (except for version). E.g. options.silent = true.

The returned result is not a contract set in stone yet (this module is still in prerelease status).

## TODO

- add bower support
- add dependency management
- handle -alpha or -rc.1 versions

## Contribute

### Run tests

```
npm test
```

### Generate coverage

```
npm run coverage
```
