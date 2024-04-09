import { readdir } from 'fs/promises'
import { resolve } from 'path'
import fs from 'node:fs/promises'
import { TileClusters, tiles2clusters, TileSet } from 'tiles-math'

const ZOOM = 17

async function* getFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getFiles(res)
        } else if (dirent.name.endsWith('gpx')) {
            yield res
        }
    }
}

type TileNo = { x: number, y: number }
const allTiles : Array<TileNo> = new Array<TileNo>()
const allTileArray : Array<Array<TileNo>> = new Array<Array<TileNo>>()
const incTileArray : Array<Array<TileNo>> = new Array<Array<TileNo>>()
const path = process.cwd() + '/data/' + ZOOM
for await (const file of getFiles(path)) {
    // console.log('----->', file)
    const buffer = await fs.readFile(file)
    const tiles : Array<TileNo> = JSON.parse(buffer.toString())
    // console.log('----->', tiles)
    allTiles.push(...tiles)
    allTileArray.push([...allTiles])
    incTileArray.push(tiles)
    // console.log('----->', tiles.length, allTiles.length, allTileArray[allTileArray.length - 1].length)
}
//console.log('----->', allTileArray[allTileArray.length - 1].length, incTileArray[incTileArray.length - 1].length)

let clusters : TileClusters = undefined

console.log('=====> BULK')
const bulkStart = new Date()
for (const tileArray of allTileArray) {
    const tileSet = new TileSet(ZOOM).addTiles(tileArray)
    clusters = tiles2clusters(tileSet)
    // console.log('----->', tileArray.length, clusters.maxCluster.getSize())
}
const bulkEnd = new Date()
console.log('----->', allTileArray.length, bulkEnd.getTime() - bulkStart.getTime(), clusters.maxCluster.getSize(), clusters.allClusters.length, clusters.minorClusters.getSize(), clusters.detachedTiles.getSize(), clusters.allTiles.getSize())

clusters = undefined

console.log('=====> INCR')
const incrStart = new Date()
for (const tileArray of incTileArray) {
    const newTiles = new TileSet(ZOOM).addTiles(tileArray)
    clusters = tiles2clusters(newTiles, clusters)
    // console.log('----->', tileArray.length, clusters.maxCluster.getSize())
}
const incrEnd = new Date()
console.log('----->', incTileArray.length, incrEnd.getTime() - incrStart.getTime(), clusters.maxCluster.getSize(), clusters.allClusters.length, clusters.minorClusters.getSize(), clusters.detachedTiles.getSize(), clusters.allTiles.getSize())
