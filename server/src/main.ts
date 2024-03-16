import express from 'express'
import { resolve } from 'path'
import { readdir } from 'fs/promises'

const app = express()
const port = 5555

let fileIterator : AsyncGenerator<string, void, undefined>

app.get('/init', async (req, res) => {
    fileIterator = getFiles('/Users/torsten/git/strava-activity-downloader/data')
    res.sendStatus(204)
})

app.get('/next', async (req, res) => {
    if (!fileIterator) {
        console.warn('Called /next without /init')
        res.sendStatus(400)
        return
    }
    const entry = await fileIterator.next()
    if (entry.done) {
        res.sendStatus(404)
    }
    res.send(entry.value)
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
