import { dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import GpxParser from 'gpxparser'
import { Coords, tiles2clusters, TileSet } from 'tiles-math'

async function* getFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getFiles(res)
        } else if (dirent.name.endsWith('gpx')) {
            yield res
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

function createFileName(inFilePath: string, zoom: number): string {
    const parts = inFilePath.split('/')
    return process.cwd() + '/data/' + zoom + '/' + parts.toSpliced(0, parts.length - 3).join('/')
}

async function writeFile(outFilePath: string, tiles: TileSet) {
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    const data = tiles.map(({ x, y }) => ({ x, y }))
    await fs.writeFile(outFilePath, JSON.stringify(data))
    console.log('--o-->', outFilePath)
}

const args = process.argv.slice(2) // Strip node and script paths
if (args.length !== 2 || Number.isNaN(parseInt(args[1]))) {
    console.error('Need path and zoom level as arguments')
    process.exit(-1)
}
const path = args[0]
const zoom = parseInt(args[1])

let prevSize = 0
const allTiles = new TileSet(zoom)
let deltaTiles = new TileSet(zoom)
for await (const inFile of getFiles(path)) {
    // console.log('--i-->', inFile)
    const newTiles = new TileSet(zoom).addCoords(await parseFile(inFile))
    for (const tile of newTiles) {
        if (!allTiles.has(tile)) {
            allTiles.addTile(tile)
            deltaTiles.addTile(tile)
        }
    }
    const { maxCluster } = tiles2clusters(allTiles) // TODO: Incremental clustering
    if (maxCluster.getSize() > prevSize) {
        prevSize = maxCluster.getSize()
        const outFile = createFileName(inFile, zoom)
        await writeFile(outFile, deltaTiles)
        deltaTiles = new TileSet(zoom) // TODO: TileSet.clear ?
    }
}
