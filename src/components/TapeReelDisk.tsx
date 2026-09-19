import React, { useRef, useState, useEffect, useCallback } from 'react';

interface TapeReelDiskProps {
  isSpinning: boolean;
  isPaused: boolean;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onScrub?: (deltaAngle: number) => void;
  size?: number;
}

export const TapeReelDisk: React.FC<TapeReelDiskProps> = ({
  isSpinning,
  isPaused,
  onHoldStart,
  onHoldEnd,
  onScrub,
  size = 312,
}) => {
  const [rotation, setRotation] = useState<number>(0);
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const diskRef = useRef<HTMLDivElement | null>(null);
  const lastAngleRef = useRef<number>(0);

  // Motorized continuous rotation loop
  useEffect(() => {
    const rpm = 33.3; // RPM rotation speed
    const degPerMs = (rpm * 360) / 60000;

    const animate = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (isSpinning && !isPaused && !isGrabbing) {
        setRotation((prev) => (prev + elapsed * degPerMs) % 360);
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      lastTimeRef.current = null;
    };
  }, [isSpinning, isPaused, isGrabbing]);

  // Pointer gesture handlers for TE TP-7 motorized spool touch & scrub
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!diskRef.current) return 0;
    const rect = diskRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsGrabbing(true);
    lastAngleRef.current = getAngleFromCenter(e.clientX, e.clientY);
    onHoldStart?.();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isGrabbing) return;
    const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
    let delta = currentAngle - lastAngleRef.current;
    
    // Normalize delta across 180/-180 seam
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    setRotation((prev) => (prev + delta) % 360);
    lastAngleRef.current = currentAngle;
    onScrub?.(delta);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isGrabbing) {
      setIsGrabbing(false);
      onHoldEnd?.();
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe catch if pointer is not captured
      }
    }
  };

  return (
    <div
      className="relative flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ width: `${size}px`, height: `${size}px` }}
      id="tp7-central-disk-container"
    >
      {/* Outer aluminum rim border */}
      <div
        ref={diskRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative rounded-full border border-black bg-white flex items-center justify-center transition-transform ${
          isGrabbing ? 'scale-[0.98]' : 'scale-100'
        }`}
        style={{
          width: '100%',
          height: '100%',
          transform: `rotate(${rotation}deg)`,
          boxShadow: 'inset 0 0 12px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        }}
        id="tp7-spinning-disk"
        title="Teenage Engineering Motorized Reel - Touch/Click to pause reel or drag to scrub"
      >
        {/* Subtle circular grooves matching TE machined finish */}
        <div className="absolute inset-4 rounded-full border border-neutral-200 pointer-events-none opacity-60" />
        <div className="absolute inset-10 rounded-full border border-neutral-100 pointer-events-none opacity-80" />
        <div className="absolute inset-20 rounded-full border border-neutral-200 pointer-events-none opacity-40" />

        {/* Black Indicator Line across diameter */}
        <div
          className="absolute w-[1.2px] bg-black pointer-events-none"
          style={{ height: `${size * 0.89}px` }}
        />

        {/* Center Motorized Spindle Hub */}
        <div
          className="relative rounded-full bg-white border border-black flex items-center justify-center shadow-sm pointer-events-none"
          style={{ width: '60px', height: '60px' }}
        >
          {/* Internal core dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-black/80" />
        </div>
      </div>
    </div>
  );
};
