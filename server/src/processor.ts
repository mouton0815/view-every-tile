import { dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import GpxParser from 'gpxparser'
import { Coords, Tile, TileNo, tiles2clusters, TileSet } from 'tiles-math'

type Track = Array<Coords>

type GPXFileContent = {
    name: string
    time: Date
    track: Track
}

type TilesArray = Array<TileNo>

type TilesFileContent = GPXFileContent & {
    tiles: TilesArray
}

type TileSetSerialized = {
    zoom: number
    tiles: TilesArray
}

const toTileNo = ({ x, y }: Tile): TileNo => ({ x, y }) // Drop z field

async function* getGPXFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await fs.readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getGPXFiles(res)
        } else if (dirent.name.endsWith('gpx')) {
            yield res
        }
    }
}

async function readGPXFile(filePath: string) : Promise<GPXFileContent> {
    try {
        const data = await fs.readFile(filePath);
        // @ts-ignore
        const gpx = new GpxParser()
        gpx.parse(data.toString())
        if (!gpx.tracks || gpx.tracks.length !== 1 || !gpx.tracks[0].points || gpx.tracks[0].points.length < 1) {
            console.warn('No tracks array in file', filePath)
        } else {
            const trk = gpx.tracks[0]
            const name = trk.name
            const time = trk.points[0].time
            const track = trk.points.map(({lat, lon}) => ([lat, lon]))
            return { name, time, track }
        }
    } catch (err) {
        console.warn('Cannot read GPX file', filePath, err)
    }
}

// TODO: File ending 'gpx' is wrong
function createTilesFileName(inFilePath: string, zoom: number): string {
    const parts = inFilePath.split('/')
    return process.cwd() + '/data/' + zoom + '/' + parts.toSpliced(0, parts.length - 3).join('/')
}

async function writeTilesFile(outFilePath: string, content: TilesFileContent) {
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    await fs.writeFile(outFilePath, JSON.stringify(content))
    console.log('--o-->', outFilePath)
}


function createClustersFileName(zoom: number): string {
    return process.cwd() + '/data/' + zoom + '/tiles.json'
}

async function readClustersFile(filePath: string) : Promise<TileSet | null> {
    try {
        const buffer = await fs.readFile(filePath)
        const parsed: TileSetSerialized = JSON.parse(buffer.toString())
        return new TileSet(parsed.zoom).addTiles(parsed.tiles)
    } catch (err) {
        console.info('Cannot read clusters file', filePath, '(this may be expected)')
        return null
    }
}

async function writeClustersFile(outFilePath: string, tiles: TileSet) {
    const serialized : TileSetSerialized = {
        zoom: tiles.getZoom(),
        tiles: tiles.map(({ x, y }: Tile): TileNo => ({ x, y })) // Drop z field
    }
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    await fs.writeFile(outFilePath, JSON.stringify(serialized))
    console.log('--c-->', outFilePath)
}

const args = process.argv.slice(2) // Strip node and script paths
if (args.length !== 2 || Number.isNaN(parseInt(args[1]))) {
    console.error('Need <data_path> and <zoom_level> as arguments')
    process.exit(-1)
}
const gpxPath = args[0]
const zoom = parseInt(args[1])

let snapshot = await readClustersFile(createClustersFileName(zoom))
// const limit = snapshot ? 50 : 10
let clusters = snapshot ? tiles2clusters(snapshot) : null
let prevSize = clusters ? clusters.maxCluster.getSize() : 0
const deltaTiles = new TileSet(zoom)
// let counter = 0
for await (const inFilePath of getGPXFiles(gpxPath)) {
    // if (++counter > limit) break
    // console.log('--i-->', inFilePath)
    const { name, time, track } = await readGPXFile(inFilePath)
    const newTiles = new TileSet(zoom).addCoords(track)
    // console.log('--d-->', newTiles.getSize(), inFilePath)
    clusters = tiles2clusters(newTiles, clusters)
    deltaTiles.addTiles(clusters.newTiles)
    // console.log('--x-->', clusters.maxCluster.getSize(), prevSize, clusters.allTiles.getSize(), clusters.detachedTiles.getSize())
    if (clusters.maxCluster.getSize() > prevSize) {
        prevSize = clusters.maxCluster.getSize()
        const tiles = deltaTiles.map(toTileNo)
        const outFilePath = createTilesFileName(inFilePath, zoom)
        await writeTilesFile(outFilePath, { name, time, track, tiles })
        snapshot = clusters.allTiles.clone(true)
        deltaTiles.clear()
    }
}

if (snapshot) {
    const outFilePath = createClustersFileName(zoom)
    await writeClustersFile(outFilePath, snapshot)
}
