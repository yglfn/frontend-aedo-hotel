import './Tabs.css';

export interface TabOption {
  value: string;
  label: string;
}

export interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ options, value, onChange }: TabsProps) {
  return (
    <div className="tabs-container">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`tab-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
