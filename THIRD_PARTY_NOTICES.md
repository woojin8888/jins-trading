# Third-party source notices

## User-provided Pine indicator

The user supplied a Pine v5 file headed:

> This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
> Combined indicator: Minervini Trend Template (© yogy.frestarahmawan) + Volume Profile / Fixed Range (© LonesomeTheBlue)

`src/pine-minervini.js` is adapted from the Minervini/RS section of that file and is made available in source form in this repository under the Mozilla Public License 2.0. Its original attribution and license notice are retained in that source file. The original 13/26/39/52-bar offsets and denominator multipliers are intentionally preserved. `src/pine-template.js` now ports the fixed-range body/wick volume allocation, POC and value-area rules. Both adapted modules and the original user-provided Pine file are published under `/source/` in production (linked from the chart table). Their MPL notices and author attribution are preserved. `npm run prepare:pine` refreshes the public copies; the build rejects stale copies.

License text: https://mozilla.org/MPL/2.0/

## TradingView Lightweight Charts

The chart renderer uses the Apache-2.0 licensed Lightweight Charts package. Existing TradingView attribution is retained. This website is independently implemented and is not an official TradingView product.
