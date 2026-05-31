import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { EmptyState } from "./KpiCard";

const AXIS = { fontSize: 11, stroke: "hsl(var(--muted-foreground))" } as const;
const TOOLTIP_STYLE = {
  fontSize: 11,
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 4,
};

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#14b8a6"];

export function TrendLine({
  data,
  keys,
  height = 220,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  height?: number;
}) {
  if (!data.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tick={AXIS as never} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS as never} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {keys.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarBreakdown({
  data,
  height = 220,
  horizontal = false,
}: {
  data: Array<{ name: string; value: number }>;
  height?: number;
  horizontal?: boolean;
}) {
  if (!data.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 8, left: horizontal ? 24 : -16, bottom: 0 }}
      >
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS as never} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={AXIS as never} tickLine={false} axisLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={AXIS as never} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS as never} tickLine={false} axisLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill={PALETTE[0]} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedBar({
  data,
  keys,
  height = 220,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  height?: number;
}) {
  if (!data.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tick={AXIS as never} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS as never} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="s" fill={PALETTE[i % PALETTE.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}