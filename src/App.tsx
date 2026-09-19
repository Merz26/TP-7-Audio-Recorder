import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecordingData, TransportState } from './types.ts';
import { TapeReelDisk } from './components/TapeReelDisk.tsx';
import { LevelMeter } from './components/LevelMeter.tsx';
import { RecordingItem } from './components/RecordingItem.tsx';
import { Mic, Volume2 } from 'lucide-react';

export default function App() {
  // Transport and recording states
  const [transportState, setTransportState] = useState<TransportState>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [currentDateDisplay, setCurrentDateDisplay] = useState<{ label: string; day: string }>({
    label: 'TODAY',
    day: new Date().getDate().toString().padStart(2, '0'),
  });

  // Level Meter reactive level (0 to 1)
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Recordings list
  const [recordings, setRecordings] = useState<RecordingData[]>(() => {
    // Initial sample recordings inspired by TP-7 demo recordings
    return [
      {
        id: 'sample-1',
        duration: '0.00.42',
        durationSeconds: 42,
        transcription:
          'Field notes on acoustic acoustics and resonant frequencies. The TP-7 motorized spool provides instant mechanical feedback while capturing pristine audio.',
        time: '11:45 AM',
        dateStr: new Date().toISOString(),
        section: 'Today',
        isTranscribing: false,
      },
      {
        id: 'sample-2',
        duration: '0.01.15',
        durationSeconds: 75,
        transcription:
          'Design review of aluminum tactile rocker switches, zero-backlash geartrain, and USB audio streaming capabilities for handheld podcasting.',
        time: '04:20 PM',
        dateStr: new Date(Date.now() - 86400000).toISOString(),
        section: 'Yesterday',
        isTranscribing: false,
      },
    ];
  });

  // Playback state
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<Record<string | number, number>>({});
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0);

  // Audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameMeterRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>('');

  // Audio playback reference
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Format seconds to TP-7 clock format: 0.00.00 (h.mm.ss)
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}.${minutes.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}`;
  };

  // Update date badge
  useEffect(() => {
    const now = new Date();
    setCurrentDateDisplay({
      label: 'TODAY',
      day: now.getDate().toString().padStart(2, '0'),
    });
  }, []);

  // Timer interval for active recording
  useEffect(() => {
    let interval: any = null;
    if (transportState === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else if (transportState === 'idle' || transportState === 'playing') {
      // Don't reset recording duration if paused during recording
      if (transportState === 'idle') {
        setRecordingDuration(0);
      }
    }
    return () => clearInterval(interval);
  }, [transportState]);

  // Audio level analysis loop for mic or playback
  const startLevelMeter = useCallback((stream?: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      if (stream) {
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale smoothly between 0 and 1
          const normalized = Math.min(1, Math.max(0, avg / 128));
          setAudioLevel(normalized);
        }
        animFrameMeterRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Web Audio level meter setup error:', e);
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (animFrameMeterRef.current) {
      cancelAnimationFrame(animFrameMeterRef.current);
      animFrameMeterRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Real-time speech recognition setup
  const startLiveSpeechRecognition = useCallback(() => {
    liveTranscriptRef.current = '';
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript + ' ';
          }
          liveTranscriptRef.current = current.trim();
        };

        recognition.onerror = (err: any) => {
          console.warn('Speech recognition notice:', err.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization skipped:', err);
      }
    }
  }, []);

  const stopLiveSpeechRecognition = useCallback((): string => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Safe catch
      }
      speechRecognitionRef.current = null;
    }
    return liveTranscriptRef.current;
  }, []);

  // Server audio transcription helper
  const transcribeAudioOnServer = async (audioBlob: Blob, recordId: string | number) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setRecordings((prev) =>
            prev.map((rec) =>
              rec.id === recordId
                ? { ...rec, transcription: data.text, isTranscribing: false }
                : rec
            )
          );
          return;
        }
      }
    } catch (err) {
      console.warn('Server transcription request error:', err);
    }

    // Fallback if server returned no transcript and client didn't capture one
    setRecordings((prev) =>
      prev.map((rec) =>
        rec.id === recordId && rec.transcription === 'Transcribing...'
          ? {
              ...rec,
              transcription:
                liveTranscriptRef.current ||
                'Audio recorded successfully on TP-7 tape spool.',
              isTranscribing: false,
            }
          : rec
      )
    );
  };

  // Start Recording
  const startRecording = async () => {
    try {
      // If currently playing, stop playback first
      if (playingId) {
        stopPlayback();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      micStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        const liveText = stopLiveSpeechRecognition();

        const newId = Date.now();
        const durationSec = recordingDuration;
        const now = new Date();

        const newRec: RecordingData = {
          id: newId,
          duration: formatDuration(durationSec),
          durationSeconds: durationSec,
          transcription: liveText || 'Transcribing...',
          time: now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
          dateStr: now.toISOString(),
          section: 'Today',
          audioBlob: audioBlob,
          audioUrl: audioUrl,
          isTranscribing: !liveText,
        };

        setRecordings((prev) => [newRec, ...prev]);

        // If no instant live transcription was detected, send to server
        if (!liveText) {
          transcribeAudioOnServer(audioBlob, newId);
        }
      };

      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;

      startLiveSpeechRecognition();
      startLevelMeter(stream);

      setRecordingDuration(0);
      setTransportState('recording');
    } catch (err: any) {
      console.error('Microphone access error:', err);
      alert('Microphone permission is required to record audio with TP-7.');
      setTransportState('idle');
    }
  };

  // Pause / Resume Recording
  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (transportState === 'recording') {
      mediaRecorderRef.current.pause();
      setTransportState('recording_paused');
      stopLevelMeter();
    } else if (transportState === 'recording_paused') {
      mediaRecorderRef.current.resume();
      setTransportState('recording');
      if (micStreamRef.current) {
        startLevelMeter(micStreamRef.current);
      }
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    stopLevelMeter();
    setTransportState('idle');
  };

  // Save current recording
  const saveCurrentRecording = () => {
    if (transportState === 'recording' || transportState === 'recording_paused') {
      stopRecording();
    }
  };

  // Audio Playback
  const playRecording = (recording: RecordingData) => {
    if (!recording.audioUrl) return;

    // Stop recording if active
    if (transportState === 'recording' || transportState === 'recording_paused') {
      stopRecording();
    }

    // Stop current audio if playing
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }

    const audio = new Audio(recording.audioUrl);
    audioElementRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        setPlaybackProgress((prev) => ({
          ...prev,
          [recording.id]: pct,
        }));
        setCurrentPlaybackTime(audio.currentTime);
      }
    };

    audio.onended = () => {
      setPlayingId(null);
      setIsPlaybackPaused(false);
      setTransportState('idle');
      stopLevelMeter();
      setPlaybackProgress((prev) => ({
        ...prev,
        [recording.id]: 0,
      }));
    };

    audio.onerror = () => {
      setPlayingId(null);
      setIsPlaybackPaused(false);
      setTransportState('idle');
      stopLevelMeter();
    };

    audio.play().then(() => {
      setPlayingId(recording.id);
      setIsPlaybackPaused(false);
      setTransportState('playing');
      // Synthetic reactive level meter for playback
      startSyntheticPlaybackMeter();
    }).catch((err) => {
      console.warn('Playback error:', err);
    });
  };

  const startSyntheticPlaybackMeter = () => {
    const update = () => {
      // Natural oscillating audio level during playback
      const val = 0.35 + Math.sin(Date.now() / 90) * 0.25 + Math.random() * 0.2;
      setAudioLevel(val);
      animFrameMeterRef.current = requestAnimationFrame(update);
    };
    update();
  };

  const pausePlayback = () => {
    if (!audioElementRef.current) return;

    if (audioElementRef.current.paused) {
      audioElementRef.current.play();
      setIsPlaybackPaused(false);
      setTransportState('playing');
      startSyntheticPlaybackMeter();
    } else {
      audioElementRef.current.pause();
      setIsPlaybackPaused(true);
      setTransportState('playing_paused');
      stopLevelMeter();
    }
  };

  const stopPlayback = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      audioElementRef.current = null;
    }
    setPlayingId(null);
    setIsPlaybackPaused(false);
    setTransportState('idle');
    stopLevelMeter();
  };

  const playMostRecentRecording = () => {
    const playable = recordings.find((r) => r.audioUrl);
    if (playable) {
      playRecording(playable);
    } else if (recordings.length > 0) {
      alert('No recorded audio file found. Press the orange circle to record audio!');
    }
  };

  // Tape Spool Interactive Touch & Scrub
  const handleDiskHoldStart = () => {
    if (transportState === 'recording') {
      pauseRecording();
    } else if (transportState === 'playing') {
      pausePlayback();
    }
  };

  const handleDiskHoldEnd = () => {
    if (transportState === 'recording_paused') {
      pauseRecording();
    } else if (transportState === 'playing_paused') {
      pausePlayback();
    }
  };

  const handleDiskScrub = (deltaAngle: number) => {
    if (audioElementRef.current && audioElementRef.current.duration) {
      const scrubSec = (deltaAngle / 360) * 3; // 3 seconds per rotation
      audioElementRef.current.currentTime = Math.max(
        0,
        Math.min(audioElementRef.current.duration, audioElementRef.current.currentTime + scrubSec)
      );
    }
  };

  const handleDeleteRecording = (id: string | number) => {
    if (playingId === id) {
      stopPlayback();
    }
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  const isSpinning =
    transportState === 'recording' || transportState === 'playing';
  const isTapePaused =
    transportState === 'recording_paused' || transportState === 'playing_paused';
  const isActivelyRecording =
    transportState === 'recording' || transportState === 'recording_paused';

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center py-6 px-4">
      {/* Handheld Device Container */}
      <div className="w-full max-w-[440px] flex flex-col" id="tp7-app-root">
        
        {/* Main TP-7 Hardware Chassis */}
        <div
          className="relative bg-white rounded-2xl border-[1.2px] border-black overflow-hidden shadow-xl mb-4 transition-all"
          id="tp7-device-body"
        >
          {/* Top Section */}
          <div className="flex items-start justify-between mt-3.5 mr-3.5 mb-5 px-3 relative">
            {/* Top Left Speaker Grill Dots */}
            <div className="flex items-center gap-10 mt-2 ml-16 pt-3">
              <div className="w-2 h-2 rounded-full bg-black" />
              <div className="w-2 h-2 rounded-full bg-black" />
            </div>

            {/* Top Right High-Contrast Digital Display */}
            <div
              className={`rounded border px-2 py-1 min-w-[80px] bg-white transition-colors duration-150 ${
                isActivelyRecording ? 'border-[#f0630d]' : 'border-black'
              }`}
              id="tp7-lcd-display"
            >
              <div
                className={`font-mono-jb text-[17px] font-bold text-center tracking-tight leading-snug transition-colors ${
                  isActivelyRecording ? 'text-[#f0630d]' : 'text-black'
                }`}
              >
                {isActivelyRecording || recordingDuration > 0
                  ? formatDuration(recordingDuration)
                  : playingId && audioElementRef.current
                  ? formatDuration(currentPlaybackTime)
                  : '0.00.00'}
              </div>

              <div className="flex items-center justify-between mt-0.5 pt-0.5 border-t border-neutral-200">
                <span className="font-mono-jb text-[10px] font-bold text-black tracking-wider">
                  {currentDateDisplay.label}
                </span>
                <div className="bg-black rounded-[2px] px-1 py-[1px] min-w-[14px] flex items-center justify-center">
                  <span className="font-mono-jb text-[10px] font-bold text-white leading-none">
                    {currentDateDisplay.day}
                  </span>
                </div>
              </div>
            </div>

            {/* Orange Square Accent Top Right */}
            <div className="w-[13px] h-[13px] bg-[#f0630d] absolute top-[74px] right-1 pointer-events-none" />
          </div>

          {/* Main Area with Rocker Controls and Motorized Reel */}
          <div className="relative flex items-center justify-center py-5 min-h-[340px]">
            {/* Left Controls: Rocker Arrows and R label */}
            <div className="absolute left-2.5 top-0 bottom-0 w-5 flex flex-col justify-between items-center py-2 z-10">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (audioElementRef.current) {
                      audioElementRef.current.currentTime = Math.max(0, audioElementRef.current.currentTime - 5);
                    }
                  }}
                  className="w-4 h-4 flex items-center justify-center text-black font-mono-jb font-bold text-sm cursor-pointer hover:opacity-70 transition-opacity"
                  title="Rewind (5s)"
                  id="rocker-up-1"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (audioElementRef.current) {
                      audioElementRef.current.currentTime = Math.min(
                        audioElementRef.current.duration || 0,
                        audioElementRef.current.currentTime + 5
                      );
                    }
                  }}
                  className="w-4 h-4 flex items-center justify-center text-black font-mono-jb font-bold text-sm cursor-pointer hover:opacity-70 transition-opacity"
                  title="Fast-Forward (5s)"
                  id="rocker-up-2"
                >
                  ▲
                </button>
              </div>

              <div className="flex-1" />

              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (playingId) {
                      pausePlayback();
                    } else if (isActivelyRecording) {
                      pauseRecording();
                    }
                  }}
                  className="w-4 h-4 flex items-center justify-center text-black font-mono-jb font-bold text-sm rotate-180 cursor-pointer hover:opacity-70 transition-opacity"
                  title="Rocker Flip Toggle"
                  id="rocker-down"
                >
                  ▲
                </button>
                <span
                  className="text-black font-mono-jb font-semibold text-sm -rotate-90 select-none"
                  title="Record / Reel Indicator"
                >
                  R
                </span>
              </div>
            </div>

            {/* Central Motorized Tape Reel Disk */}
            <TapeReelDisk
              isSpinning={isSpinning}
              isPaused={isTapePaused}
              onHoldStart={handleDiskHoldStart}
              onHoldEnd={handleDiskHoldEnd}
              onScrub={handleDiskScrub}
              size={290}
            />

            {/* Bottom Left Black Dot Accent */}
            <div className="absolute bottom-2 left-7 w-7 h-7 rounded-full bg-black pointer-events-none" />
          </div>

          {/* Bottom Control Section */}
          <div className="flex items-center h-[90px] border-t border-black bg-white" id="tp7-transport-bar">
            {/* Record Button (Orange Circle) */}
            <button
              type="button"
              onClick={isActivelyRecording ? stopRecording : startRecording}
              className="flex-1 h-full flex items-center justify-center border-r border-black cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
              title={isActivelyRecording ? 'Stop Recording' : 'Start Recording'}
              id="tp7-record-button"
            >
              <div
                className="w-4 h-4 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: isActivelyRecording ? '#ff3333' : '#f0630d',
                  transform: isActivelyRecording ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: isActivelyRecording ? '0 0 10px #ff3333' : 'none',
                }}
              />
            </button>

            {/* Play Button (▶) */}
            <button
              type="button"
              onClick={
                playingId
                  ? pausePlayback
                  : playMostRecentRecording
              }
              className="flex-1 h-full flex items-center justify-center border-r border-black cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors font-mono-jb font-bold text-2xl text-black"
              title={playingId ? (isPlaybackPaused ? 'Resume' : 'Pause') : 'Play Most Recent'}
              id="tp7-play-button"
            >
              {playingId && !isPlaybackPaused ? '⏸' : '▶'}
            </button>

            {/* Stop Button (Black Square) */}
            <button
              type="button"
              onClick={() => {
                if (isActivelyRecording) {
                  stopRecording();
                } else if (playingId) {
                  stopPlayback();
                }
              }}
              className="flex-1 h-full flex items-center justify-center border-r border-black cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors"
              title="Stop"
              id="tp7-stop-button"
            >
              <div className="w-3.5 h-3.5 bg-[#333333] rounded-[1px]" />
            </button>

            {/* Level Indicator Bars */}
            <div className="flex-1 h-full flex items-center justify-center">
              <LevelMeter
                level={audioLevel}
                isActive={isActivelyRecording || (playingId !== null && !isPlaybackPaused)}
                barCount={5}
              />
            </div>
          </div>
        </div>

        {/* Save Recording Button */}
        <button
          type="button"
          onClick={saveCurrentRecording}
          disabled={!isActivelyRecording}
          className={`w-full py-3.5 px-4 rounded-lg font-mono-jb text-[17px] font-bold text-center transition-all cursor-pointer mb-5 shadow-xs ${
            isActivelyRecording
              ? 'bg-[#ff6b35] text-white hover:bg-[#e05824] active:scale-[0.99]'
              : 'bg-neutral-300 text-neutral-600 cursor-not-allowed opacity-60'
          }`}
          id="save-recording-button"
        >
          {isActivelyRecording ? 'Save Recording' : 'Save'}
        </button>

        {/* Status helper banner */}
        <div className="flex items-center justify-between px-1 text-xs font-mono-jb text-neutral-500 mb-2">
          <div className="flex items-center gap-1.5">
            <Mic className={`w-3.5 h-3.5 ${isActivelyRecording ? 'text-red-500 animate-pulse' : 'text-neutral-400'}`} />
            <span>{isActivelyRecording ? 'Capturing audio + live STT' : 'Ready to record'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Volume2 className={`w-3.5 h-3.5 ${playingId ? 'text-[#f0630d]' : 'text-neutral-400'}`} />
            <span>{playingId ? 'Replaying' : `${recordings.length} items`}</span>
          </div>
        </div>

        {/* Recordings Section */}
        <div className="w-full mt-2" id="recordings-list-section">
          {recordings.length === 0 ? (
            <p className="font-mono-jb text-sm text-neutral-400 text-center py-10 italic">
              No recordings yet
            </p>
          ) : (
            <>
              {/* Today Section */}
              {recordings.filter((r) => r.section === 'Today').length > 0 && (
                <div className="mb-4">
                  <h3 className="font-mono-jb text-base font-bold text-neutral-800 mb-2.5 tracking-tight">
                    Today
                  </h3>
                  {recordings
                    .filter((r) => r.section === 'Today')
                    .map((recording) => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        isPlaying={playingId === recording.id && !isPlaybackPaused}
                        isPaused={playingId === recording.id && isPlaybackPaused}
                        progress={playbackProgress[recording.id] || 0}
                        onPlay={() => playRecording(recording)}
                        onPause={pausePlayback}
                        onDelete={() => handleDeleteRecording(recording.id)}
                      />
                    ))}
                </div>
              )}

              {/* Yesterday Section */}
              {recordings.filter((r) => r.section === 'Yesterday').length > 0 && (
                <div className="mb-4">
                  <h3 className="font-mono-jb text-base font-bold text-neutral-800 mb-2.5 tracking-tight">
                    Yesterday
                  </h3>
                  {recordings
                    .filter((r) => r.section === 'Yesterday')
                    .map((recording) => (
                      <RecordingItem
                        key={recording.id}
                        recording={recording}
                        isPlaying={playingId === recording.id && !isPlaybackPaused}
                        isPaused={playingId === recording.id && isPlaybackPaused}
                        progress={playbackProgress[recording.id] || 0}
                        onPlay={() => playRecording(recording)}
                        onPause={pausePlayback}
                        onDelete={() => handleDeleteRecording(recording.id)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
