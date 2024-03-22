import express from 'express'
import cors from 'cors'
import { resolve } from 'path'
import { readdir } from 'fs/promises'
import GpxParser from 'gpxparser'
import fs from 'node:fs/promises'

const port = 5555

const app = express()
app.use(cors())


let fileIterator : AsyncGenerator<string, void, undefined>

// let counter = 0

app.get('/init', async (req, res) => {
    // counter = 0
    fileIterator = getFiles('/Users/torsten/git/strava-activity-downloader/data')
    res.sendStatus(204)
})

app.get('/next', async (req, res) => {
    if (!fileIterator) {
        console.warn('Called /next without /init')
        res.sendStatus(400)
        return
    }
    /*
    if (++counter >= 100) {
        console.warn('Counter')
        res.sendStatus(400)
        return
    }
    */
    const entry = await fileIterator.next()
    if (entry.done || !entry.value) {
        res.sendStatus(404)
        return
    }
    try {
        const data = await fs.readFile(entry.value);
        const gpx = new GpxParser()
        gpx.parse(data.toString())
        if (!gpx.tracks || gpx.tracks.length !== 1 || !gpx.tracks[0].points) {
            console.warn('No tracks array in file', entry.value)
            res.send([])
        } else {
            const coords = gpx.tracks[0].points.map(({lat, lon}) => ([lat, lon]))
            res.send(coords)
        }
    } catch (err) {
        console.warn('Cannot read GPX file', entry.value, err)
        res.sendStatus(404)
    }
})

async function* getFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else {
            yield res;
        }
    }
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
