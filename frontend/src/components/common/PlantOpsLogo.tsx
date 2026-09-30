import React from 'react';

interface PlantOpsLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const PlantOpsLogo: React.FC<PlantOpsLogoProps> = ({
  size = 32,
  className = '',
  showText = false
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/PlantOps logo.png"
        alt="PlantOps Logo"
        width={size}
        height={size}
        className="object-contain shrink-0 rounded-lg drop-shadow-xs"
        style={{ width: size, height: size }}
      />
      {showText && (
        <div className="min-w-0">
          <div className="font-extrabold text-sm text-[#1E293B] tracking-tight leading-none">
            PLANT<span className="text-[#2563EB]">OPS</span>
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5 leading-none font-medium truncate">
            Autonomous Factory OS
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantOpsLogo;
