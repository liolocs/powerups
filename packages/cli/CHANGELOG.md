# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.5.0](https://github.com/liolocs/powerups/compare/v0.4.1...v0.5.0) (2026-09-11)

### Features

* add global skills dir constants and missing_harness error ([1df69d1](https://github.com/liolocs/powerups/commit/1df69d175012975fff19d0f03bb2183155c779e5))
* add harness-skills builtin powerup with create-powerup skill ([f7123ca](https://github.com/liolocs/powerups/commit/f7123ca9b9f1654fa5c53a491bf4c9b7fdc96714))
* add pup harness init ([1b71158](https://github.com/liolocs/powerups/commit/1b71158b8a07c974153e54676710e1796222fee5))
* add pup harness update and remove ([b60f580](https://github.com/liolocs/powerups/commit/b60f580d0b995b5f77a2e8804555a51fa3971077))
* **program:** add collectFlagTypes helper for merged flag type schema ([7dea1f0](https://github.com/liolocs/powerups/commit/7dea1f053ecdde7364c58a5f96b82ca240d60ae8))
* **program:** pass merged flag type schema to parseArgs in CLI.run ([08c35e9](https://github.com/liolocs/powerups/commit/08c35e9c5033af1f998bbc704ad2231b937e3a46))
* **program:** support space-separated flag values via flag types ([95a9978](https://github.com/liolocs/powerups/commit/95a9978d4e04ef91eb5e7868123d9cf35d1b5cd3))
* wire up the pup harness command ([ac4fc35](https://github.com/liolocs/powerups/commit/ac4fc35174519c4c944724ab9abcb56bb910bc4c))

### Bug Fixes

* **program:** keep values containing equals signs intact in parseArgs ([9e468ac](https://github.com/liolocs/powerups/commit/9e468aca15a6c826303f815b4f126f5a413b16ba))
## [0.4.1](https://github.com/liolocs/powerups/compare/v0.4.0...v0.4.1) (2026-09-11)

### Bug Fixes

* .gitignore missing in build ([f6ecb60](https://github.com/liolocs/powerups/commit/f6ecb601a6f3ac2363217053651fddab7a7889d8))
* gitignore ([6a5ab09](https://github.com/liolocs/powerups/commit/6a5ab093a764f677323828ea915b07508eb60e72))
* remove tsup ([10681f7](https://github.com/liolocs/powerups/commit/10681f7359d3bc4779220bd76adeac6d8e68cbb6))
## [0.4.0](https://github.com/liolocs/powerups/compare/v1.1.1...v0.4.0) (2026-09-11)

### Features

* **preview:** report whether a render changed any output ([6d99126](https://github.com/liolocs/powerups/commit/6d9912694597a70399e9b3f8d2be09d8a62386f9))
* **preview:** watch instruction-referenced files outside src/ ([0696663](https://github.com/liolocs/powerups/commit/06966630186b65943970d92954ecde34d54e0012))

### Bug Fixes

* gitignore ([725f601](https://github.com/liolocs/powerups/commit/725f601a7fe9c443d95915255713be62bfa2362d))
* preview ([8409117](https://github.com/liolocs/powerups/commit/8409117fdfc280c1877141bb23b6782682ed64b1))
* **preview:** kill the whole supervised process tree on restart and stop ([c77972f](https://github.com/liolocs/powerups/commit/c77972f9064ef5bfb2762a9c7ba721495e43f786))
* **preview:** resolve nodemon relative to the powerup root instead of the CLI ([59fb5ad](https://github.com/liolocs/powerups/commit/59fb5adb29139c52b7dbdb097dd68c89131958d9))
* **preview:** restart dev server only after output changes, stop watching the output dir ([d98991f](https://github.com/liolocs/powerups/commit/d98991f69c70730cde5d7ca30b269e58d5e62221))
* **preview:** treat a blank exec as absent instead of spawning an empty command ([53b067f](https://github.com/liolocs/powerups/commit/53b067fcd9c0cc62532f08279e3b25fe576801b6))
## [0.2.0](https://github.com/liolocs/powerups/compare/v0.1.0...v0.2.0) (2026-08-25)

### Features

* implement new install command with npm and git support ([3b608a9](https://github.com/liolocs/powerups/commit/3b608a94cc4d1607f8bf30ab2566cbaaf485e6ba))
* prepare install tests ([5dbe8b0](https://github.com/liolocs/powerups/commit/5dbe8b07e607ec2af424ad898bc4810d3376be77))
* uninstall command — remove powerups from config and disk ([e0b3c6a](https://github.com/liolocs/powerups/commit/e0b3c6ae96eeed77477e7b7bf8dc599415efa22e))

### Bug Fixes

* boolean flag support in @liolocs/program + install command bugfixes ([a20f7e1](https://github.com/liolocs/powerups/commit/a20f7e14a49ff2414a158c0a5b406a7a5820ac28))
* create powerup ([bf47760](https://github.com/liolocs/powerups/commit/bf47760aa662c16def61f3c5b2683bee26a85cd6))
* create-powerup ([66b2264](https://github.com/liolocs/powerups/commit/66b226444c1a40f67f0025fe95989b72325ab7f8))
* issues with use ([e575570](https://github.com/liolocs/powerups/commit/e575570d4bd1c5312a8494c5c190393a49cf31d2))
* powerup name resolution — store name in config, resolve paths via parseSource ([c431eca](https://github.com/liolocs/powerups/commit/c431ecad1219b1acdf91f1faf29989473ad01fca))
* resolve template paths relative to dist/ directory ([3c97974](https://github.com/liolocs/powerups/commit/3c97974056204c760d5283bfbd4ebe47eaf42475))
## [0.0.1](https://github.com/liolocs/powerups/compare/v0.0.0...v0.0.1) (2026-07-28)

### Bug Fixes

* bundle program into cli package ([fb0133b](https://github.com/liolocs/powerups/commit/fb0133b4021d43c519a3e806f6a4becfcdcf858d))

## 0.0.0 (2026-07-28)

### Features

* added initial commands (add / create / doctor / find / info / init / pack / update / validate) 