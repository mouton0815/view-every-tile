import { useEffect, useState } from 'react'
import { MapContainer, Polyline, Rectangle, TileLayer, useMap } from 'react-leaflet'
import { Bounds, Coords } from 'tiles-math'

// Constants controlling the map view and tile generation
const mapZoom = 9
const addDelay = 2000 // Delay between adding two random tiles

type TileStuff = {
    all: Array<Bounds>
    det: Array<Bounds>
    min: Array<Bounds>
    max: Array<Bounds>
    cen: Coords
    bnd: Array<Array<Coords>>
    box: Bounds
    sqr: Bounds
}

type TileContainerProps = {
    clusters: TileStuff
}

// Displays detached tiles (red), minor clusters (purple), max cluster (blue), boundaries lines of
// the max cluster (blue), and the centroid of the max cluster (orange).
const TileContainer = ({ clusters }: TileContainerProps) => {
    const { det, min, max, bnd, sqr } = clusters
    return (
        <div>
            <>
                {det.map((bounds, index) => (
                    <Rectangle key={index} bounds={bounds} pathOptions={{ color: 'red', weight: 0.5, opacity: 0.5 }} />
                ))}
            </>
            <>
                {min.map((bounds, index) => (
                    <Rectangle key={index} bounds={bounds} pathOptions={{ color: 'purple', weight: 1, opacity: 1 }} />
                ))}
            </>
            <>
                {max.map((bounds, index) => (
                    <Rectangle key={index} bounds={bounds} pathOptions={{ color: 'blue', weight: 0.5, opacity: 0.5 }} />
                ))}
            </>
            <>
                {bnd.map((line, index) => (
                    <Polyline key={index} positions={line} pathOptions={{ color: 'blue', weight: 2, opacity: 1 }} />
                ))}
            </>
            <>
                {sqr &&
                    <Rectangle bounds={sqr} pane={'markerPane'} pathOptions={{ fill: false, color: 'yellow', weight: 3, opacity: 1 }} />
                }
            </>
        </div>
    )
}

const MyComponent = ({ clusters }: TileContainerProps) => {
    const map = useMap()
    map.fitBounds(clusters.box)
    return null
}

export const App = () => {
    const [clusters, setClusters] = useState<TileStuff | null>(null)

    useEffect(() => {
        const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
        (async function() {
            try {
                let response = await fetch('http://localhost:5555/init')
                if (!response.ok) {
                    return
                }
                while ((response = await fetch('http://localhost:5555/next')).ok) {
                    const newClusters: TileStuff = await response.json()
                    //console.log('----->', coords)
                    setClusters(newClusters)
                    await timer(addDelay)
                }
            } catch (error) {
                console.error(`Download error: ${error}`);
            }
        })()
    }, [])

    if (clusters === null) {
        return <b>Waiting for data from server...</b>
    }

    return (
        <MapContainer
            center={clusters.cen}
            zoom={mapZoom}
            zoomSnap={0.1}
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