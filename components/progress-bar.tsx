type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progress-track" aria-hidden="true">
      <div className="progress-value" style={{ width: `${value}%` }} />
    </div>
  );
}
