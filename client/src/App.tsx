import { useEffect, useState } from 'react'
import { Circle, MapContainer, Polyline, Rectangle, TileLayer } from 'react-leaflet'
import { coords2tile, cluster2boundaries, cluster2square, tiles2clusters, Coords, TileSet } from 'tiles-math'

// Constants controlling the map view and tile generation
const tileZoom = 14 // VeloViewer and others use zoom-level 14 tiles
const edgeSize = 12 // Edge length of the map area to be filled with random tiles (should be an even number
const addDelay = 100 // Delay between adding two random tiles
const areaCenter : Coords = [51.476, -0.008]

type TileContainerProps = {
    tiles: TileSet
}

// Displays detached tiles (red), minor clusters (purple), max cluster (blue), boundaries lines of
// the max cluster (blue), and the centroid of the max cluster (orange).
const TileContainer = ({ tiles }: TileContainerProps) => {
    const { detachedTiles, minorClusters, maxCluster } = tiles2clusters(tiles)
    const maxSquare = cluster2square(maxCluster).getCenterSquare()
    const boundaries = cluster2boundaries(maxCluster)
    const centroid = maxCluster.centroid()
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
            <>
                {centroid &&
                    <Circle center={centroid.position()} pane={'markerPane'} radius={200} pathOptions={{ color: 'orange', weight: 3, opacity: 1 }} />
                }
            </>
        </div>
    )
}

const defaultCenter : Coords = [51.483, -0.008]

export const App = () => {
    const centerTile = coords2tile(areaCenter, tileZoom)
    const leftBorder = centerTile.x - edgeSize / 2
    const upperBorder = centerTile.y - edgeSize / 2
    const mapZoom = tileZoom - Math.ceil(edgeSize / 12) - 1
    const areaSize = edgeSize * edgeSize

    const initTileSet = new TileSet(tileZoom).addTile(centerTile)
    const [tileSet, setTileSet] = useState<TileSet>(initTileSet)

    useEffect(() => {
        // Call useEffect repeatedly to add more random tiles
        const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
        (async function() {
            while (tileSet.getSize() < areaSize) {
                const tileNo = { x: leftBorder + randomInt(edgeSize), y: upperBorder + randomInt(edgeSize) }
                setTileSet(tileSet.addTile(tileNo).clone())
                await timer(addDelay)
            }
        })()
    }, [])

    return (
        <MapContainer
            center={defaultCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            style={{ height: '100vh', minWidth: '100vw' }}>
            <TileLayer
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <TileContainer tiles={tileSet} />
        </MapContainer>
    )
}

function randomInt(max: number): number {
    return Math.floor(Math.random() * max);
}