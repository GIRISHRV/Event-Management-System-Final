
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as L from 'leaflet';

declare module 'leaflet' {
    namespace MarkerClusterGroup {
        interface PolylineOptions {
            color?: string;
            weight?: number;
            opacity?: number;
        }
    }

    interface MarkerClusterGroupOptions {
        showCoverageOnHover?: boolean;
        zoomToBoundsOnClick?: boolean;
        spiderfyOnMaxZoom?: boolean;
        removeOutsideVisibleBounds?: boolean;
        animate?: boolean;
        animateAddingMarkers?: boolean;
        disableClusteringAtZoom?: number;
        maxClusterRadius?: number | ((zoom: number) => number);
        polygonOptions?: MarkerClusterGroup.PolylineOptions;
        singleMarkerMode?: boolean;
        spiderLegPolylineOptions?: MarkerClusterGroup.PolylineOptions;
        spiderfyDistanceMultiplier?: number;
        iconCreateFunction?: (cluster: MarkerCluster) => DivIcon;
        chunkedLoading?: boolean;
        chunkDelay?: number;
    }

    class MarkerClusterGroup extends LayerGroup {
        constructor(options?: MarkerClusterGroupOptions);
        addLayer(layer: Layer): this;
        removeLayer(layer: Layer): this;
        addLayers(layers: Layer[]): this;
        removeLayers(layers: Layer[]): this;
        clearLayers(): this;
        getBounds(): LatLngBounds;
        zoomToShowLayer(layer: Layer, callback?: () => void): void;
        getVisibleParent(layer: Layer): MarkerCluster | null;
        refreshClusters(layers?: Layer | Layer[] | LayerGroup | Marker | Marker[]): this;
        getChildCount(): number;
        getAllChildMarkers(): Marker[];
        hasLayer(layer: Layer): boolean;
    }

    interface MarkerCluster extends Marker {
        getChildCount(): number;
        getAllChildMarkers(): Marker[];
        spiderfy(): void;
        unspiderfy(): void;
        getBounds(): LatLngBounds;
    }
}

declare module 'leaflet.markercluster' {
    import * as L from 'leaflet';
    export = L;
}
