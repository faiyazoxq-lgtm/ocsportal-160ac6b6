import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { L, buildPinIcon, statusColor } from "./leafletSetup";
import type { MapWorkOrder } from "@/hooks/useWorkOrderMapData";

// Default centre: UK (Birmingham roughly)
const UK_CENTRE: [number, number] = [52.5, -1.9];

function ClusteredMarkers({
  items,
  onSelect,
}: {
  items: MapWorkOrder[];
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = (L as unknown as {
      markerClusterGroup: (opts?: Record<string, unknown>) => L.MarkerClusterGroup;
    }).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    const bounds: L.LatLngTuple[] = [];
    for (const w of items) {
      if (w.latitude == null || w.longitude == null) continue;
      const marker = L.marker([w.latitude, w.longitude], {
        icon: buildPinIcon(statusColor(w.current_status)),
      });
      const title = w.job_summary ?? "Job";
      const addr = [w.address_line_1, w.postcode].filter(Boolean).join(", ");
      const eng = w.assigned_engineer_names.join(", ") || "Unassigned";
      const html = `
        <div style="font-size:12px;line-height:1.4;min-width:180px">
          <div style="font-family:monospace;color:#666">${w.order_no}</div>
          <div style="font-weight:600;margin:2px 0">${escapeHtml(title)}</div>
          <div style="color:#555">${escapeHtml(addr)}</div>
          <div style="margin-top:4px"><b>Status:</b> ${w.current_status}</div>
          <div><b>Priority:</b> ${w.priority_level}</div>
          <div><b>Engineer:</b> ${escapeHtml(eng)}</div>
          <button data-wo-id="${w.id}" style="margin-top:6px;padding:4px 8px;
            background:#111;color:#fff;border:0;border-radius:3px;cursor:pointer;font-size:11px">
            Open job
          </button>
        </div>`;
      marker.bindPopup(html);
      marker.on("popupopen", (e) => {
        const el = (e.popup as L.Popup).getElement();
        const btn = el?.querySelector<HTMLButtonElement>(`button[data-wo-id="${w.id}"]`);
        btn?.addEventListener("click", () => onSelect(w.id), { once: true });
      });
      group.addLayer(marker);
      bounds.push([w.latitude, w.longitude]);
    }
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    }
  }, [items, map, onSelect]);

  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function DispatchMapView({
  items,
  onSelect,
  height = "70vh",
}: {
  items: MapWorkOrder[];
  onSelect: (id: string) => void;
  height?: string;
}) {
  const located = useMemo(
    () => items.filter((w) => w.latitude != null && w.longitude != null),
    [items],
  );

  return (
    <div
      className="overflow-hidden rounded-md border border-border"
      style={{ height }}
    >
      <MapContainer
        center={UK_CENTRE}
        zoom={6}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusteredMarkers items={located} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}