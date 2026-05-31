import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Fix default icon path resolution under bundlers
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

type IconDefaultPrototype = L.Icon.Default & {
  _getIconUrl?: unknown;
};
delete (L.Icon.Default.prototype as IconDefaultPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl as unknown as string,
  iconUrl: iconUrl as unknown as string,
  shadowUrl: shadowUrl as unknown as string,
});

export function statusColor(status: string): string {
  switch (status) {
    case "ready_for_dispatch":
      return "#ef4444"; // red - unassigned
    case "scheduled_in_sheet":
    case "assigned":
    case "accepted":
      return "#3b82f6"; // blue - assigned/scheduled
    case "en_route":
    case "on_site":
    case "field_in_progress":
      return "#f59e0b"; // amber - in-progress
    case "field_submitted_incomplete":
    case "follow_up_required":
      return "#a855f7"; // purple - revisit
    default:
      return "#6b7280"; // gray
  }
}

export function buildPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "ocs-map-pin",
    html: `<span style="
      display:block;width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export { L };