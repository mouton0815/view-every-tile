import { dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import GpxParser from 'gpxparser'
import { Coords, Tile, TileClusters, TileNo, tiles2clusters, TileSet } from 'tiles-math'

type Track = Array<Coords>

type InFileContent = {
    name: string
    time: Date
    track: Track
}

type OutFileContent = InFileContent & {
    tiles: Array<TileNo>
}

const toTileNo = ({ x, y }: Tile): TileNo => ({ x, y }) // Drop z field

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

async function readFile(filePath: string) : Promise<InFileContent> {
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

function createFileName(inFilePath: string, zoom: number): string {
    const parts = inFilePath.split('/')
    return process.cwd() + '/data/' + zoom + '/' + parts.toSpliced(0, parts.length - 3).join('/')
}

async function writeFile(outFilePath: string, content: OutFileContent) {
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    await fs.writeFile(outFilePath, JSON.stringify(content))
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
let clusters : TileClusters | undefined = undefined
const allTiles = new TileSet(zoom)
let deltaTiles = new TileSet(zoom)
for await (const inFilePath of getFiles(path)) {
    // console.log('--i-->', inFilePath)
    const { name, time, track } = await readFile(inFilePath)
    const newTiles = new TileSet(zoom).addCoords(track)
    deltaTiles.addTiles(allTiles.mergeDiff(newTiles))
    clusters = tiles2clusters(newTiles, clusters)
    if (clusters.maxCluster.getSize() > prevSize) {
        prevSize = clusters.maxCluster.getSize()
        const tiles = deltaTiles.map(toTileNo)
        const outFilePath = createFileName(inFilePath, zoom)
        await writeFile(outFilePath, { name, time, track, tiles })
        deltaTiles = new TileSet(zoom) // TODO: TileSet.clear ?
    }
}
