import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { openState, type Shop } from "@/lib/hours";

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center[0], center[1], zoom]);
  return null;
}

export default function ShopMap({
  shops,
  center,
  zoom = 13,
  activeId,
  onSelect,
  covers = {},
}: {
  shops: Shop[];
  center: [number, number];
  zoom?: number;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  covers?: Record<string, string>;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "transparent" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} zoom={zoom} />
      {shops.map((shop) => {
        const active = shop.id === activeId;
        const state = openState(shop.hours);
        return (
          <CircleMarker
            key={shop.id}
            center={[shop.lat, shop.lng]}
            radius={active ? 12 : 8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: state.open ? "#2f7d4f" : "#8a6a55",
              fillOpacity: active ? 1 : 0.85,
            }}
            eventHandlers={{ click: () => onSelect?.(shop.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {covers[shop.id] && (
                <img
                  src={covers[shop.id]}
                  alt={`${shop.name} cafe`}
                  loading="lazy"
                  className="mb-1 h-20 w-32 rounded-md object-cover"
                />
              )}
              <span className="font-medium">{shop.name}</span>
              <br />
              {state.open ? "Open now" : "Closed"} · {state.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
