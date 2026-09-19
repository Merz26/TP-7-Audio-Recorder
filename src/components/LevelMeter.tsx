import React from 'react';

interface LevelMeterProps {
  level: number; // 0 to 1
  isActive: boolean;
  barCount?: number;
}

export const LevelMeter: React.FC<LevelMeterProps> = ({
  level,
  isActive,
  barCount = 5,
}) => {
  // Compute active bars based on current level
  const normalizedLevel = isActive ? Math.max(0.15, Math.min(1, level)) : 0;
  const activeCount = isActive ? Math.ceil(normalizedLevel * barCount) : 0;

  return (
    <div className="flex items-end gap-[3px] h-[22px] px-2 py-1 justify-center" id="level-meter">
      {Array.from({ length: barCount }).map((_, idx) => {
        const isBarLit = isActive && idx < activeCount;
        // Natural varying height for physical meter look
        const heightPct = 35 + ((idx + 1) / barCount) * 65;

        return (
          <div
            key={idx}
            className="w-[2.5px] rounded-full transition-all duration-75 ease-out"
            style={{
              height: `${heightPct}%`,
              backgroundColor: isBarLit ? '#f0630d' : '#e0e0e0',
              boxShadow: isBarLit ? '0 0 4px rgba(240, 99, 13, 0.4)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
};
