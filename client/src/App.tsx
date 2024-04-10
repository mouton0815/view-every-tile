import { useEffect, useState } from 'react'
import { MapContainer, Polyline, Rectangle, TileLayer, useMap } from 'react-leaflet'
import { cluster2boundaries, cluster2square, Coords, TileClusters, TileNo, tiles2clusters, TileSet } from 'tiles-math'

// Constants controlling the map view and tile generation
const tileZoom = 14 // VeloViewer and others use zoom-level 14 tiles
const mapZoom = 9
const addDelay = 2000 // Delay between adding two random tiles

type RequestContent = {
    name: string
    time: Date
    track: Array<Coords>
    tiles: Array<TileNo>
}

type State = {
    clusters: TileClusters
    track: Array<Coords>
}

type TileContainerProps = State

type MapBoundsControlProps = {
    clusters: TileClusters
}

// Displays detached tiles (red), minor clusters (purple), max cluster (blue), boundaries lines of
// the max cluster (blue), and the centroid of the max cluster (orange).
const TileContainer = ({ clusters, track }: TileContainerProps) => {
    const { allTiles, detachedTiles, minorClusters, maxCluster } = clusters
    const maxSquare = cluster2square(allTiles).getCenterSquare()
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
            <Polyline positions={track} pane={'markerPane'} pathOptions={{ color: 'red', weight: 2, opacity: 0.7 }} />
        </div>
    )
}

const MapBoundsControl = ({ clusters }: MapBoundsControlProps) => {
    const mapBounds = clusters.maxCluster.boundingBox(1)
    if (mapBounds) {
        useMap().fitBounds(mapBounds.bounds())
    }
    return null
}

let incrClusters : TileClusters | undefined = undefined

export const App = () => {
    const [state, setState] = useState<State | null>(null)

    useEffect(() => {
        const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
        (async function() {
            try {
                let response = await fetch(`http://localhost:5555/init/${tileZoom}`)
                if (!response.ok) {
                    return
                }
                while ((response = await fetch('http://localhost:5555/next')).ok) {
                    const result : RequestContent = await response.json()
                    const newTiles = new TileSet(tileZoom).addTiles(result.tiles)
                    console.log('----->', result.time, result.name)
                    incrClusters = tiles2clusters(newTiles, incrClusters)
                    setState({ clusters: incrClusters, track: result.track })
                    await timer(addDelay)
                }
            } catch (error) {
                console.error(`Download error: ${error}`);
            }
        })()
    }, [])

    if (state === null) {
        return <b>Waiting for data from server...</b>
    }

    const mapCenter = state.clusters.maxCluster.centroid()?.position()
    return (
        <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            zoomSnap={0.1}
            scrollWheelZoom={true}
            style={{ height: '100vh', minWidth: '100vw' }}>
            <TileLayer
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsControl clusters={state.clusters} />
            <TileContainer clusters={state.clusters} track={state.track} />
        </MapContainer>
    )
}