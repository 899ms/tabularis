import { type ReactNode } from "react";
import clsx from "clsx";

/* ── Section ── */

interface SettingSectionProps {
  title: string;
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SettingSection({ title, icon, description, action, children }: SettingSectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {title}
        </h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {description && (
        <p className="text-xs text-muted mb-3">{description}</p>
      )}
      <div className="border-t border-default pt-1">{children}</div>
    </div>
  );
}

/* ── Row ── */

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  vertical?: boolean;
}

export function SettingRow({
  label,
  description,
  children,
  vertical,
}: SettingRowProps) {
  if (vertical) {
    return (
      <div className="py-3">
        <div className="mb-2">
          <div className="text-sm text-primary">{label}</div>
          {description && (
            <div className="text-xs text-muted mt-0.5">{description}</div>
          )}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-3 gap-8">
      <div className="min-w-0">
        <div className="text-sm text-primary">{label}</div>
        {description && (
          <div className="text-xs text-muted mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Toggle ── */

interface SettingToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingToggle({
  checked,
  onChange,
  disabled,
}: SettingToggleProps) {
  return (
    <label
      className={clsx(
        "relative inline-flex items-center w-10 h-6 shrink-0",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-base border border-strong transition-colors peer-checked:bg-accent-primary peer-checked:border-accent-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
      />
      <span
        aria-hidden="true"
        className="relative ml-1 w-4 h-4 rounded-full bg-primary transition-all peer-checked:bg-inverse peer-checked:translate-x-4"
      />
    </label>
  );
}

/* ── ButtonGroup ── */

interface ButtonGroupOption<T> {
  value: T;
  label: string;
}

interface SettingButtonGroupProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: Array<ButtonGroupOption<T>>;
  mono?: boolean;
}

export function SettingButtonGroup<T extends string | number>({
  value,
  onChange,
  options,
  mono,
}: SettingButtonGroupProps<T>) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            mono && "font-mono",
            value === opt.value
              ? "bg-accent-primary border-accent-primary text-inverse shadow-lg shadow-accent-primary/20"
              : "bg-base border-default text-muted hover:border-strong hover:text-primary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Slider ── */

interface SettingSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
}

export function SettingSlider({
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
}: SettingSliderProps) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div className="flex items-center gap-4 min-w-[200px]">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          onChange(
            step < 1
              ? parseFloat(e.target.value)
              : parseInt(e.target.value),
          )
        }
        className="flex-1 h-2 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-accent-primary"
      />
      <span className="text-sm font-mono text-primary w-16 text-right">
        {display}
      </span>
    </div>
  );
}

/* ── NumberInput ── */

interface SettingNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  fallback?: number;
}

export function SettingNumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  fallback = 0,
}: SettingNumberInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || fallback)}
        className="bg-base border border-strong rounded px-3 py-2 text-primary w-24 focus:outline-none focus:border-focus transition-colors"
      />
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </div>
  );
}
