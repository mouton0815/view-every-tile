import express from 'express'
import cors from 'cors'
import { resolve } from 'path'
import { readdir } from 'fs/promises'
import fs from 'node:fs/promises'

const PORT = 5555

const app = express()
app.use(cors())

let fileIterator : AsyncGenerator<string, void, undefined>

app.get('/init/:zoom', async (req, res) => {
    const path = process.cwd() + '/data/' + req.params.zoom
    fileIterator = getFiles(path)
    res.sendStatus(204)
})

app.get('/next', async (req, res) => {
    if (!fileIterator) {
        console.warn('Called /next without /init')
        res.sendStatus(400)
        return
    }
    const entry = await fileIterator.next()
    if (entry.done || !entry.value) {
        res.sendStatus(404)
        return
    }
    try {
        res.send(await fs.readFile(entry.value))
    } catch (err) {
        console.warn('Cannot read tiles file', entry.value, err)
        res.sendStatus(404)
    }
})

async function* getFiles(dir: string): AsyncGenerator<string, void, undefined> {
    const dirents = await readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = resolve(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getFiles(res)
        } else if (dirent.name.endsWith('json')) {
            yield res
        }
    }
}

app.listen(PORT, () => {
    console.log(`Tile server listening on port ${PORT}`)
})
