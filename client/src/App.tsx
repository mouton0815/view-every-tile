import { useEffect, useState } from 'react'
import { MapContainer, Polyline, Rectangle, TileLayer, useMap } from 'react-leaflet'
import {
    cluster2boundaries,
    cluster2square,
    tiles2clusters,
    Coords,
    TileSet,
    TileRectangle,
    TileClusters
} from 'tiles-math'

// Constants controlling the map view and tile generation
const tileZoom = 14 // VeloViewer and others use zoom-level 14 tiles
const mapZoom = 9
const addDelay = 200 // Delay between adding two random tiles

type Clusters = TileClusters & { allTiles: TileSet }

type TileContainerProps = {
    clusters: Clusters
}

// Displays detached tiles (red), minor clusters (purple), max cluster (blue), boundaries lines of
// the max cluster (blue), and the centroid of the max cluster (orange).
const TileContainer = ({ clusters }: TileContainerProps) => {
    const { detachedTiles, minorClusters, maxCluster } = clusters
    const maxSquare = cluster2square(maxCluster).getCenterSquare()
    const boundaries = cluster2boundaries(maxCluster)
    return (
        <div>
            <>
                {detachedTiles.map((tile, index) => (
                    <Rectangle key={index} bounds={tile.bounds()} pathOptions={{ color: 'red', weight: 0.5, opacity: 0.5 }} />
                ))}
            </>
            <>
                {minorClusters.map((tile, index) => (
                    <Rectangle key={index} bounds={tile.bounds()} pathOptions={{ color: 'purple', weight: 1, opacity: 1 }} />
                ))}
            </>
            <>
                {maxCluster.map((tile, index) => (
                    <Rectangle key={index} bounds={tile.bounds()} pathOptions={{ color: 'blue', weight: 0.5, opacity: 0.5 }} />
                ))}
            </>
            <>
                {boundaries.map((line, index) => (
                    <Polyline key={index} positions={line.positions()} pathOptions={{ color: 'blue', weight: 2, opacity: 1 }} />
                ))}
            </>
            <>
                {maxSquare &&
                    <Rectangle bounds={maxSquare.bounds()} pane={'markerPane'} pathOptions={{ fill: false, color: 'yellow', weight: 3, opacity: 1 }} />
                }
            </>
        </div>
    )
}

const MyComponent = ({ clusters }: TileContainerProps) => {
    const map = useMap()
    //console.log('map center:', map.getCenter())

    let x1 = Number.MAX_SAFE_INTEGER
    let y1 = Number.MAX_SAFE_INTEGER
    let x2 = Number.MIN_SAFE_INTEGER
    let y2 = Number.MIN_SAFE_INTEGER
    for (const tile of clusters.maxCluster) {
        x1 = Math.min(x1, tile.x)
        y1 = Math.min(y1, tile.y)
        x2 = Math.max(x2, tile.x + 1)
        y2 = Math.max(y2, tile.y + 1)
    }
    const mapBounds = TileRectangle.of(x1, y1, x2 - x1 + 1, y2 - y1 + 1, tileZoom)
    // console.log('----->', mapBounds)
    map.fitBounds(mapBounds.bounds())

    return null
}

export const App = () => {
    const emptyTileSet = new TileSet(tileZoom)
    const initClusters : Clusters = { allTiles: emptyTileSet, detachedTiles: emptyTileSet, minorClusters: emptyTileSet, maxCluster: emptyTileSet }
    const [clusters, setClusters] = useState<Clusters>(initClusters)

    useEffect(() => {
        const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
        (async function() {
            try {
                let response = await fetch('http://localhost:5555/init')
                if (!response.ok) {
                    return
                }
                while ((response = await fetch('http://localhost:5555/next')).ok) {
                    const coords: Array<Coords> = await response.json()
                    //console.log('----->', coords)
                    const prevSize = clusters.maxCluster.getSize()
                    const allTiles = clusters.allTiles.clone().addCoords(coords)
                    const newClusters = tiles2clusters(allTiles)
                    if (newClusters.maxCluster.getSize() > prevSize) { // Some tracks may not add new tiles
                        // console.log('----->', prevSize, newClusters.maxCluster.getSize(), allTiles.getSize())
                        setClusters({ allTiles, ...newClusters })
                        //setClusters({ allTiles, detachedTiles: newClusters.detachedTiles, minorClusters: newClusters.minorClusters, maxCluster: newClusters.maxCluster })
                        await timer(addDelay)
                    }
                }
            } catch (error) {
                console.error(`Download error: ${error}`);
            }
        })()
    }, [])

    if (clusters.maxCluster.getSize() === 0) {
        return <b>Waiting for data from server...</b>
    }

    const mapCenter = clusters.maxCluster.centroid()?.position() || [0, 0]

    return (
        <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            style={{ height: '100vh', minWidth: '100vw' }}>
            <TileLayer
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MyComponent clusters={clusters} />
            <TileContainer clusters={clusters} />
        </MapContainer>
    )
}