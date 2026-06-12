// Pulls in the L.MarkerClusterGroup type augmentation even though the plugin
// itself is loaded at runtime via its dist path (see initializeMap).
/// <reference types="leaflet.markercluster" />

declare module 'leaflet.markercluster/dist/leaflet.markercluster.js';
