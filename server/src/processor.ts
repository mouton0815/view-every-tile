import { dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import GpxParser from 'gpxparser'
import { Bounds, Coords, TileClusters, cluster2square, tiles2clusters, TileSet, cluster2boundaries } from 'tiles-math'

const ZOOM = 14

async function* getFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else {
            yield res;
        }
    }
}

async function parseFile(file: string) : Promise<Array<Coords>> {
    try {
        const data = await fs.readFile(file);
        // @ts-ignore
        const gpx = new GpxParser()
        gpx.parse(data.toString())
        if (!gpx.tracks || gpx.tracks.length !== 1 || !gpx.tracks[0].points) {
            console.warn('No tracks array in file', file)
        } else {
            return gpx.tracks[0].points.map(({lat, lon}) => ([lat, lon]))
        }
    } catch (err) {
        console.warn('Cannot read GPX file', file, err)
    }
}

/*
function tileMath(coords: Array<Coords>): TileClusters {
    const tiles = new TileSet(14).addCoords(coords)
    return tiles2clusters(tiles)
}
*/

function createFileName(inFilePath: string): string {
    const parts = inFilePath.split('/')
    return process.cwd() + '/data/' + parts.toSpliced(0, parts.length - 3).join('/')
}

function toBounds(tiles: TileSet): Array<Bounds> {
    return tiles.toArray().map(tile => tile.bounds())
}

async function writeFile(outFilePath: string, { allTiles, detachedTiles, minorClusters, maxCluster }: TileClusters) {
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    const all = toBounds(allTiles)
    const det = toBounds(detachedTiles)
    const min = toBounds(minorClusters)
    const max = toBounds(maxCluster)
    const cen = maxCluster.centroid().position()
    const bnd = cluster2boundaries(maxCluster).map(line => line.positions())
    const box = maxCluster.boundingBox(0).bounds()
    const sqr = cluster2square(allTiles).getCenterSquare().bounds()
    const data = JSON.stringify({ all, det, min, max, cen, bnd, sqr, box })
    await fs.writeFile(outFilePath, data)
    console.log('--o-->', outFilePath)
}

let prevSize = 0
const allTiles = new TileSet(ZOOM)
for await (const inFile of getFiles('/Users/torsten/git/strava-activity-downloader/data')) {
    console.log('--i-->', inFile)
    allTiles.addCoords(await parseFile(inFile))
    const tileClusters = tiles2clusters(allTiles)
    if (tileClusters.maxCluster.getSize() > prevSize) {
        const outFile = createFileName(inFile)
        await writeFile(outFile, tileClusters)
        prevSize = tileClusters.maxCluster.getSize()
    }
}
