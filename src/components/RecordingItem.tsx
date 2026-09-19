import React, { useState } from 'react';
import { RecordingData } from '../types.ts';
import { Download, Trash2 } from 'lucide-react';

interface RecordingItemProps {
  recording: RecordingData;
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onDelete?: () => void;
}

export const RecordingItem: React.FC<RecordingItemProps> = ({
  recording,
  isPlaying,
  isPaused,
  progress,
  onPlay,
  onPause,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const isLongTranscription =
    recording.transcription && recording.transcription.length > 200;

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else if (isPaused) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recording.audioUrl) return;
    const a = document.createElement('a');
    a.href = recording.audioUrl;
    a.download = `TP7-Recording-${recording.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="bg-white p-2.5 mb-2.5 border border-black/80 flex flex-col gap-2.5 transition-shadow hover:shadow-xs"
      id={`recording-item-${recording.id}`}
    >
      {/* Top Row: Play button + Progress bar + Duration */}
      <div className="flex items-center w-full">
        <button
          type="button"
          onClick={recording.audioUrl ? handlePlayPause : undefined}
          disabled={!recording.audioUrl}
          className={`w-6 h-6 flex items-center justify-center mr-2 cursor-pointer font-mono-jb text-base transition-colors ${
            recording.audioUrl
              ? 'text-[#f0630d] hover:text-[#d3540a]'
              : 'text-neutral-300 cursor-not-allowed'
          }`}
          title={isPlaying ? 'Pause' : 'Play'}
          id={`play-btn-${recording.id}`}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="flex-1 h-[3px] bg-neutral-200 mr-2 relative rounded-full overflow-hidden">
          <div
            className="h-full bg-[#f0630d] transition-all duration-100 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        <div className="px-1.5 flex items-center gap-2">
          <span className="font-mono-jb text-[15px] font-semibold text-black tracking-tight">
            {recording.duration}
          </span>
          {recording.audioUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="text-neutral-400 hover:text-black p-0.5 rounded transition-colors"
              title="Download Audio"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-neutral-300 hover:text-red-500 p-0.5 rounded transition-colors"
              title="Delete Recording"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Row: Transcription + Timestamp */}
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div className="flex-1 flex flex-col gap-1 pr-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-mono-jb text-[11px] font-bold text-neutral-400 uppercase tracking-wide">
              Transcription
            </span>
            {recording.isTranscribing && (
              <span className="font-mono-jb text-[10px] text-[#f0630d] font-medium italic animate-pulse">
                Processing...
              </span>
            )}
          </div>

          <p
            className={`font-mono-jb text-[14.5px] text-black leading-relaxed ${
              recording.isTranscribing ? 'italic text-neutral-600' : ''
            } ${!isExpanded ? 'line-clamp-3' : ''}`}
          >
            {recording.transcription || 'No transcription available'}
          </p>

          {isLongTranscription && !recording.isTranscribing && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-mono-jb text-xs font-bold text-[#f0630d] hover:text-[#d3540a] mt-1 self-start cursor-pointer"
            >
              {isExpanded ? 'Read Less' : 'Read More'}
            </button>
          )}
        </div>

        <div className="shrink-0 self-end pb-0.5">
          <span className="font-mono-jb text-[11px] font-bold text-neutral-400">
            {recording.time}
          </span>
        </div>
      </div>
    </div>
  );
};
