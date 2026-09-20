import { useEffect, useRef, useState } from "react";
import { Map as LibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./shop-map.css";
import { useNow } from "@/hooks/useNow";
import { openState, type Shop } from "@/lib/hours";

// Serve the worker with the app, rather than loading executable code from a CDN.
setWorkerUrl(mapWorkerUrl);
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const EMPTY_COVERS: Record<string, string> = {};

type MapStatus = "loading" | "ready" | "error";

export default function ShopMap({
  shops,
  center,
  zoom = 13,
  activeId,
  onSelect,
  covers = EMPTY_COVERS,
}: {
  shops: Shop[];
  center: [number, number];
  zoom?: number;
  activeId?: string | null;
  onSelect?: (id: string) => void;
  covers?: Record<string, string>;
}) {
  const now = useNow();
  const container = useRef<HTMLDivElement>(null);
  const initialView = useRef({ center, zoom });
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const [map, setMap] = useState<LibreMap | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [lat, lng] = center;

  useEffect(() => {
    if (!container.current) return;
    const element = container.current;
    let instance: LibreMap | undefined;
    let failed = false;
    let disposed = false;
    const fail = () => {
      if (disposed) return;
      failed = true;
      setStatus("error");
    };
    const timeout = setTimeout(() => {
      if (!disposed) setStatus("error");
    }, 15_000);
    setStatus("loading");
    try {
      instance = new LibreMap({
        container: element,
        style: MAP_STYLE,
        center: [initialView.current.center[1], initialView.current.center[0]],
        zoom: initialView.current.zoom,
        minZoom: 2,
        maxZoom: 20,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: false,
        renderWorldCopies: false,
      });
      instance.touchZoomRotate.disableRotation();
      instance.addControl(new NavigationControl({ showCompass: false }), "top-left");
      instance.on("error", fail);
      instance.on("webglcontextlost", fail);
      instance.on("load", () => {
        clearTimeout(timeout);
        if (!disposed && !failed) setStatus("ready");
      });
      setMap(instance);
    } catch {
      // Browsers without WebGL still get a useful fallback, not a crashed route.
      clearTimeout(timeout);
      fail();
    }
    return () => {
      disposed = true;
      clearTimeout(timeout);
      instance?.off("error", fail);
      instance?.off("webglcontextlost", fail);
      instance?.remove();
      element.replaceChildren();
      setMap(null);
    };
  }, [attempt]);

  useEffect(() => {
    if (!map) return;
    map.jumpTo({ center: [lng, lat], zoom });
  }, [map, lat, lng, zoom]);

  useEffect(() => {
    if (!map) return;
    const markers: Marker[] = [];
    const popups: Popup[] = [];
    const buttons = new Map<string, HTMLButtonElement>();
    for (const shop of shops) {
      if (!Number.isFinite(shop.lat) || !Number.isFinite(shop.lng)) continue;
      const state = openState(shop.hours, now);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cafe-map-pin";
      button.setAttribute("aria-label", `${shop.name} — ${state.open ? "Open now" : "Closed"}`);
      const dot = document.createElement("span");
      dot.className = "cafe-map-dot";
      dot.style.backgroundColor = state.open ? "#2f7d4f" : "#8a6a55";
      button.append(dot);

      // Shop details are untrusted text. Do not interpolate them into HTML popups.
      const content = document.createElement("div");
      content.className = "cafe-map-tooltip";
      if (covers[shop.id]) {
        const image = document.createElement("img");
        image.src = covers[shop.id]!;
        image.alt = `${shop.name} cafe`;
        image.loading = "lazy";
        content.append(image);
      }
      const title = document.createElement("strong");
      title.textContent = shop.name;
      const hours = document.createElement("div");
      hours.textContent = state.label;
      content.append(title, hours);
      const popup = new Popup({ closeButton: false, offset: 14, maxWidth: "220px" })
        .setLngLat([shop.lng, shop.lat])
        .setDOMContent(content);
      const show = () => popup.addTo(map);
      const hide = () => popup.remove();
      button.addEventListener("mouseenter", show);
      button.addEventListener("focus", show);
      button.addEventListener("mouseleave", hide);
      button.addEventListener("blur", hide);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelect?.(shop.id);
        show();
      });
      markers.push(new Marker({ element: button }).setLngLat([shop.lng, shop.lat]).addTo(map));
      popups.push(popup);
      buttons.set(shop.id, button);
    }
    pins.current = buttons;
    return () => {
      popups.forEach((popup) => popup.remove());
      markers.forEach((marker) => marker.remove());
      pins.current = new Map();
    };
  }, [map, shops, covers, now, onSelect]);

  useEffect(() => {
    for (const [id, button] of pins.current) {
      button.dataset["active"] = String(id === activeId);
      button.setAttribute("aria-pressed", String(id === activeId));
    }
  }, [activeId, map, shops, covers, now, onSelect]);

  const selected = shops.find((shop) => shop.id === activeId);
  const externalMap = `https://www.google.com/maps/search/?api=1&query=${selected?.lat ?? lat},${selected?.lng ?? lng}`;

  return (
    <div
      className="relative h-full w-full"
      role="region"
      aria-label="Interactive cafe map"
      data-map-status={status}
    >
      <div ref={container} className="h-full w-full bg-stone-200" />
      {status === "loading" && (
        <p
          role="status"
          className="pointer-events-none absolute right-3 top-3 rounded-lg bg-background/95 px-3 py-2 text-xs text-foreground shadow"
        >
          Loading map…
        </p>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="absolute left-14 right-3 top-3 rounded-xl border border-border bg-background/95 p-3 text-sm text-foreground shadow-lg"
        >
          <p>The map couldn't load. You can still browse the cafes.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="text-primary underline"
            >
              Retry map
            </button>
            <a
              href={externalMap}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Open in Google Maps
            </a>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 right-0 max-w-full bg-white/95 px-2 py-0.5 text-right text-[10px] leading-4 text-stone-800">
        <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">
          OpenFreeMap
        </a>
        {" · "}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">
          © OpenMapTiles
        </a>
        {" · "}
        Data from{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}
