import { themeSchema, type Theme } from '@shared/schemas/settings';

const LABELS: Record<Theme, string> = { dark: 'Dark', light: 'Light', system: 'System' };

export function ThemeSwitch({
  value,
  onChange,
}: {
  value: Theme;
  onChange: (theme: Theme) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-2">
      {themeSchema.options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className="chip"
          onClick={() => onChange(option)}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
