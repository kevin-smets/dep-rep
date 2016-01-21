# dep-rep

Dependency reporter and manager for bower and npm

## Get started

### CLI usage

    npm i -g dep-rep
    
From then on, you can run `dep-rep` in any folder containing a `package.json`.

For `bower` you need to run `dep-rep -b` or `dep-rep --bower`.

### Node usage

    npm i -D dep-rep    

```
const depRep = require('dep-rep');

depRep.report(currentJsonAsString, oldJsonAsString)
```

## Contribute

### Run CI

    npm run ci
    
### Generate coverage
  
    npm run coverage
