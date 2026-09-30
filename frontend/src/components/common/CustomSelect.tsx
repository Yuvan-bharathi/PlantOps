import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: (SelectOption | string | number)[];
  placeholder?: string;
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'right';
  fullWidth?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  prefix,
  icon,
  className = '',
  dropdownClassName = '',
  disabled = false,
  size = 'sm',
  align = 'left',
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options into SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null && 'value' in opt) {
      return opt as SelectOption;
    }
    return {
      value: opt as string | number,
      label: String(opt),
    };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: 'px-2 py-1 text-[11px] gap-1.5 rounded-lg',
    sm: 'px-2.5 py-1.5 text-xs gap-2 rounded-xl',
    md: 'px-3 py-2 text-xs gap-2 rounded-xl',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${fullWidth ? 'w-full' : ''}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          flex items-center justify-between font-bold text-[#1E293B] bg-white border transition-all duration-150 shadow-2xs select-none
          ${isOpen ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15' : 'border-[#DDD9D0] hover:border-[#B5B0A4] hover:bg-[#FAF9F6]'}
          ${sizeClasses[size]}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
      >
        <div className="flex items-center gap-1.5 truncate text-left">
          {prefix && <span className="text-[#64748B] font-semibold shrink-0">{prefix}</span>}
          {icon && <span className="text-[#64748B] shrink-0">{icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 shrink-0 ml-1.5 ${
            isOpen ? 'rotate-180 text-[#2563EB]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 min-w-full w-max max-w-xs sm:max-w-sm max-h-64 overflow-y-auto bg-white border border-[#DDD9D0] rounded-xl shadow-xl py-1 focus:outline-none animate-in fade-in zoom-in-95 duration-100
            ${align === 'right' ? 'right-0' : 'left-0'}
            ${dropdownClassName}
          `}
          style={{
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#64748B] italic">No options available</div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 transition-colors duration-100 cursor-pointer
                    ${
                      isSelected
                        ? 'bg-[#2563EB]/10 text-[#2563EB] font-bold'
                        : 'text-[#1E293B] hover:bg-[#FAF9F6] font-medium'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <div className="truncate">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-[#64748B] font-normal truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#2563EB] shrink-0 stroke-[2.5]" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
