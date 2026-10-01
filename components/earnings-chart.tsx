"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/utils";

type EarningsChartProps = {
  data: Array<{
    label: string;
    total: number;
    amount: number;
  }>;
};

export function EarningsChart({ data }: EarningsChartProps) {
  if (data.length === 0) {
    return <div className="empty-state">Ingen historik registrerad än.</div>;
  }

  if (data.length === 1) {
    return <div className="single-history"><span className="eyebrow">Första posten är registrerad</span><strong className="panel-value">{formatCurrency(data[0].total)}</strong><p className="panel-subtle">{data[0].label}. När fler poster registreras visas din kurva här.</p></div>;
  }

  return (
    <div className="chart-shell" role="img" aria-label={`Insamlingen över ${data.length} poster. Senaste totalsumma: ${formatCurrency(data[data.length - 1].total)}.`}>
      <ResponsiveContainer height={280} width="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="studdeGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#facc15" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={24}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value) => `${value} kr`}
            tickLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              background: "rgba(15, 23, 42, 0.94)",
              color: "#f6f8ff",
              boxShadow: "0 24px 80px rgba(2, 6, 23, 0.32)",
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === "total" ? "Totalt" : "Senaste post",
            ]}
            labelStyle={{ color: "#f8fafc", fontWeight: 600 }}
          />
          <Area
            dataKey="total"
            fill="url(#studdeGradient)"
            fillOpacity={1}
            name="total"
            stroke="#facc15"
            strokeWidth={3}
            isAnimationActive={false}
            type="linear"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
