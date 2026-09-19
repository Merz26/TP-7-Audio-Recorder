export interface RecordingData {
  id: string | number;
  duration: string;
  durationSeconds: number;
  transcription: string;
  time: string;
  dateStr: string;
  section: 'Today' | 'Yesterday' | 'Earlier';
  audioBlob?: Blob;
  audioUrl?: string;
  isTranscribing?: boolean;
}

export type TransportState = 'idle' | 'recording' | 'recording_paused' | 'playing' | 'playing_paused';
