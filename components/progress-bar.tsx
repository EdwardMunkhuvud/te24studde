import { clampPercent } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progress-track" role="progressbar" aria-label="Framsteg mot målet" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clampPercent(value))}>
      <div className="progress-value" style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
}
