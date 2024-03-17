import { useEffect, useState } from 'react'
import { MapContainer, Polyline, Rectangle, TileLayer, useMap } from 'react-leaflet'
import { cluster2boundaries, cluster2square, tiles2clusters, Coords, TileSet, TileRectangle } from 'tiles-math'

// Constants controlling the map view and tile generation
const tileZoom = 14 // VeloViewer and others use zoom-level 14 tiles
const mapZoom = 9
const addDelay = 200 // Delay between adding two random tiles

type TileContainerProps = {
    tiles: TileSet
}

// Displays detached tiles (red), minor clusters (purple), max cluster (blue), boundaries lines of
// the max cluster (blue), and the centroid of the max cluster (orange).
const TileContainer = ({ tiles }: TileContainerProps) => {
    const { detachedTiles, minorClusters, maxCluster } = tiles2clusters(tiles)
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

const MyComponent = ({ tiles }: TileContainerProps) => {
    const map = useMap()
    //console.log('map center:', map.getCenter())

    const { maxCluster} = tiles2clusters(tiles)
    let x1 = Number.MAX_SAFE_INTEGER
    let y1 = Number.MAX_SAFE_INTEGER
    let x2 = Number.MIN_SAFE_INTEGER
    let y2 = Number.MIN_SAFE_INTEGER
    for (const tile of maxCluster) {
        x1 = Math.min(x1, tile.x)
        y1 = Math.min(y1, tile.y)
        x2 = Math.max(x2, tile.x + 1)
        y2 = Math.max(y2, tile.y + 1)
    }
    const mapBounds = TileRectangle.of(x1, y1, x2 - x1 + 1, y2 - y1 + 1, tileZoom)
    console.log('----->', mapBounds)
    map.fitBounds(mapBounds.bounds())

    return null
}

export const App = () => {
    const initTileSet = new TileSet(tileZoom)
    const [tileSet, setTileSet] = useState<TileSet>(initTileSet)

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
                    const prevSize = tileSet.getSize()
                    const newTileSet = tileSet.addCoords(coords).clone()
                    if (newTileSet.getSize() > prevSize) { // Some tracks may not add new tiles
                        setTileSet(newTileSet)
                        await timer(addDelay)
                    }
                }
            } catch (error) {
                console.error(`Download error: ${error}`);
            }
        })()
    }, [])

    if (tileSet.getSize() === 0) {
        return <b>Waiting for data from server...</b>
    }

    const mapCenter = tileSet.centroid()?.position() || [0, 0]

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
            <MyComponent tiles={tileSet} />
            <TileContainer tiles={tileSet} />
        </MapContainer>
    )
}