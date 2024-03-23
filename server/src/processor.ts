import { dirname, resolve } from 'path'
import fs from 'node:fs/promises'
import GpxParser from 'gpxparser'
import { Coords, TileClusters, tiles2clusters, TileSet } from 'tiles-math'

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

function createFileName(inFilePath: string): string {
    const parts = inFilePath.split('/')
    return process.cwd() + '/data/' + parts.toSpliced(0, parts.length - 3).join('/')
}

async function writeFile(outFilePath: string, tiles: TileSet) {
    await fs.mkdir(dirname(outFilePath), { recursive: true })
    const data = tiles.map(({ x, y }) => ({ x, y }))
    await fs.writeFile(outFilePath, JSON.stringify(data))
    console.log('--o-->', outFilePath)
}

let prevSize = 0
const allTiles = new TileSet(ZOOM)
for await (const inFile of getFiles('/Users/torsten/git/strava-activity-downloader/data')) {
    console.log('--i-->', inFile)
    allTiles.addCoords(await parseFile(inFile))
    const { maxCluster } = tiles2clusters(allTiles)
    if (maxCluster.getSize() > prevSize) {
        prevSize = maxCluster.getSize()
        const outFile = createFileName(inFile)
        await writeFile(outFile, allTiles)
    }
}
