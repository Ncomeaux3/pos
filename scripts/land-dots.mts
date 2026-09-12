// Samples the world's land as a list of points, once, from Natural Earth's
// 110m land topology (world-atlas@2, public domain). The output is committed as
// modules/travel/land.json and drawn by the hand-rolled globe as a dot matrix,
// which is how POS Travel.dc.html draws the continents. Nothing here runs at
// build or in the browser: d3-geo, topojson and world-atlas stay out of the
// bundle, as decided on 2026-09-07.
//
//   pnpm exec tsx scripts/land-dots.mts [path-to-land-110m.json]
//
// With no path it fetches https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json.

import { readFileSync, writeFileSync } from 'node:fs'
import { pointInRings, decodeTopology, sampleLand } from './land-dots-lib'

const source = process.argv[2]
const text = source
  ? readFileSync(source, 'utf8')
  : await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')).text()

const rings = decodeTopology(JSON.parse(text))
const dots = sampleLand(rings)
writeFileSync('modules/travel/land.json', JSON.stringify(dots))
console.log(`${dots.length} land points, ${JSON.stringify(dots).length} bytes; Denver is land: ${pointInRings(39.7, -105, rings)}`)
