# View Every Tile
This project provide services to compute and display the [slippy map tiles](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames),
the maximum cluster, and maximum square of all your outdoor activities on a map, just as
[VeloViewer](https://veloviewer.com/explorer), [StatsHunters](https://www.statshunters.com),
[Squadrats](https://squadrats.com/activities), and [RideEveryTile](https://rideeverytile.com) do.

Unlike the mentioned providers, this project
* uses locally stored GPX files (that can be downloaded for example with [strava-activity-downloader](https://github.com/mouton0815/strava-activity-downloader)),
* works with every zoom level (including 14 like [VeloViewer](https://veloviewer.com/explorer) and 17 used for "Squadratinhos" by [Squadrats](https://squadrats.com/activities)),
* displays the growth of your maximum cluster over the course of time in a nicely animated form.

![foo](screenshot.gif)

## Preconditions
You need [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) with `npm`.

## Running
The clustering of your GPX files is done in a preprocessing step. 
The processor writes a cluster file on every change of the maximum cluster.
The results are stored in the `data` subdirectory of the [server](./server) subproject.

Assume your GPX files are stored in folder `/user/me/strava/data`.
Then the following commands compute the clusters for zoom level 14 and 17:

```shell
cd server
npm run proc -- /user/me/strava/data 14
npm run proc -- /user/me/strava/data 17
```
This may take several minutes.

Once the clusters over time are computed, they can be delivered by the web server:

```shell
npm run serv
```

To view the data, you need to start the Vite React application with a Leaflet map:
```shell
cd ../client
npm run dev
```
Then point your browser to http://localhost:5173/

Note that on refreshing the page, the clustering animation restarts.

If you want to change the displayed zoom level (provided that you have run the preprocessing step for that level),
then change variable `tileZoom` in [App.tsx](./client/src/App.tsx) (the React application will re-compile in the background).