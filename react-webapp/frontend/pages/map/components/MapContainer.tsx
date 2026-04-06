import { Viewer, Entity, PointGraphics, Cesium3DTileset, ScreenSpaceEventHandler, ScreenSpaceEvent } from "resium"
import {
  Ion,
  Cartesian3,
  Color,
  Math as CesiumMath,
  createGooglePhotorealistic3DTileset,
  ScreenSpaceEventType,
} from "cesium"
import { useRef, useEffect, useCallback } from "react"
import type { Building } from "../types"

// Cesium ion token
Ion.defaultAccessToken =
  import.meta.env.VITE_CESIUM_ION_TOKEN ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"

// NJIT campus center — [-74.1785, 40.7420]
const NJIT_LON = -74.1785
const NJIT_LAT = 40.7420
// Camera constraints
const MIN_ZOOM_DISTANCE = 100   // closest zoom (meters)
const MAX_ZOOM_DISTANCE = 2500  // farthest zoom — keeps campus in view
const INITIAL_ALTITUDE = 600
const INITIAL_PITCH = -45       // degrees

const NJIT_RED = Color.fromCssColorString("#D32F2F")
const NJIT_RED_HIGHLIGHT = Color.fromCssColorString("#FF5252")
const DARK_BG = Color.fromCssColorString("#0f1117")

interface MapContainerProps {
  readonly buildings: readonly Building[]
  readonly selectedBuilding: Building | null
  readonly onSelectBuilding: (building: Building | null) => void
}

export default function MapContainer({
  buildings,
  selectedBuilding,
  onSelectBuilding,
}: MapContainerProps) {
  const viewerRef = useRef<{ cesiumElement?: unknown } | null>(null)
  const tilesetRef = useRef<unknown>(null)

  // Configure scene on mount: camera, fog, globe, constraints
  useEffect(() => {
    const v = viewerRef.current?.cesiumElement as Record<string, unknown> | undefined
    if (!v) return

    const scene = v.scene as {
      fog: { enabled: boolean; density: number; minimumBrightness: number }
      globe: {
        show: boolean
        baseColor: typeof DARK_BG
        depthTestAgainstTerrain: boolean
      }
      skyBox: { show: boolean }
      skyAtmosphere: { show: boolean }
      sun: { show: boolean }
      moon: { show: boolean }
      backgroundColor: typeof DARK_BG
    }
    const camera = v.camera as {
      flyTo: (opts: unknown) => void
      constrainedAxis: unknown
    }
    const screenSpaceCameraController = (scene as unknown as Record<string, unknown>).screenSpaceCameraController as Record<string, unknown> | undefined

    // ── Dark isolated background ──
    scene.backgroundColor = DARK_BG
    scene.skyBox.show = false
    scene.skyAtmosphere.show = false
    scene.sun.show = false
    scene.moon.show = false

    // ── Disable globe so 3D tiles float on dark void ──
    scene.globe.show = false

    // ── Fog — fades distant geometry into the dark background ──
    scene.fog.enabled = true
    scene.fog.density = 0.0008
    scene.fog.minimumBrightness = 0.0

    // ── Camera constraints — prevent flipping or zooming to space ──
    camera.constrainedAxis = Cartesian3.UNIT_Z
    if (screenSpaceCameraController) {
      screenSpaceCameraController["minimumZoomDistance"] = MIN_ZOOM_DISTANCE
      screenSpaceCameraController["maximumZoomDistance"] = MAX_ZOOM_DISTANCE
      screenSpaceCameraController["enableTilt"] = true
      screenSpaceCameraController["minimumCollisionTerrainHeight"] = 0
    }

    // ── Initial camera position: looking down at campus at -45° ──
    camera.flyTo({
      destination: Cartesian3.fromDegrees(NJIT_LON, NJIT_LAT, INITIAL_ALTITUDE),
      orientation: {
        heading: CesiumMath.toRadians(0),
        pitch: CesiumMath.toRadians(INITIAL_PITCH),
        roll: 0,
      },
      duration: 2.5,
    })
  }, [])

  const handleEntityClick = useCallback(
    (building: Building) => {
      const isSame = selectedBuilding?.id === building.id
      onSelectBuilding(isSame ? null : building)
    },
    [selectedBuilding, onSelectBuilding],
  )

  return (
    <Viewer
      ref={viewerRef as never}
      full
      timeline={false}
      animation={false}
      homeButton={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      sceneModePicker={false}
      geocoder={false}
      fullscreenButton={false}
      selectionIndicator={false}
      infoBox={false}
      {...{ imageryProvider: false } as Record<string, unknown>}
    >
      {/* Click empty space to deselect */}
      <ScreenSpaceEventHandler>
        <ScreenSpaceEvent
          action={(event) => {
            const viewer = viewerRef.current?.cesiumElement as
              | { scene: { pick: (pos: unknown) => unknown } }
              | undefined
            if (!viewer) return
            const pos = (event as { position?: unknown }).position
            if (!pos) return
            const picked = viewer.scene.pick(pos)
            if (!picked) onSelectBuilding(null)
          }}
          type={ScreenSpaceEventType.LEFT_CLICK}
        />
      </ScreenSpaceEventHandler>

      {/* Google Photorealistic 3D Tiles — floating campus model */}
      <Cesium3DTileset
        ref={tilesetRef as never}
        url={createGooglePhotorealistic3DTileset() as never}
        maximumScreenSpaceError={16}
        dynamicScreenSpaceError={true}
        dynamicScreenSpaceErrorDensity={0.00278}
        dynamicScreenSpaceErrorFactor={4.0}
      />

      {/* Building markers */}
      {buildings.map((building) => {
        const isSelected = selectedBuilding?.id === building.id
        return (
          <Entity
            key={building.id}
            name={building.name}
            position={Cartesian3.fromDegrees(
              building.longitude,
              building.latitude,
              50,
            )}
            onClick={() => handleEntityClick(building)}
          >
            <PointGraphics
              pixelSize={isSelected ? 18 : 12}
              color={isSelected ? NJIT_RED_HIGHLIGHT : NJIT_RED}
              outlineColor={Color.WHITE}
              outlineWidth={2}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
          </Entity>
        )
      })}
    </Viewer>
  )
}
