import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { MusicEngine, presetForIndustry, type MusicPreset } from "@/lib/music";

interface Props {
  industry: string;
}

const STORAGE_KEY = "bookit.music";
type Stored = { volume: number; muted: boolean };

function loadStored(): Stored {
  if (typeof window === "undefined") return { volume: 0.5, muted: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 0.5, muted: false };
    return JSON.parse(raw) as Stored;
  } catch {
    return { volume: 0.5, muted: false };
  }
}

function saveStored(s: Stored) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/**
 * Floating music control. Tap once to start the procedural soundtrack tuned
 * to the business's industry. Browsers require a user gesture to start
 * audio, so we never autoplay.
 */
export function MusicControls({ industry }: Props) {
  const engineRef = useRef<MusicEngine | null>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [stored, setStored] = useState<Stored>(() => loadStored());

  const preset: MusicPreset = useMemo(() => presetForIndustry(industry), [industry]);

  // Cleanup on industry change / unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
      setPlaying(false);
    };
  }, [industry]);

  function ensureEngine(): MusicEngine {
    if (!engineRef.current) engineRef.current = new MusicEngine();
    return engineRef.current;
  }

  async function toggle() {
    const engine = ensureEngine();
    if (engine.isPlaying()) {
      engine.stop();
      setPlaying(false);
      return;
    }
    engine.setVolume(stored.muted ? 0 : stored.volume);
    await engine.start(preset);
    setPlaying(true);
  }

  function setVolume(v: number) {
    const next: Stored = { volume: v, muted: false };
    setStored(next);
    saveStored(next);
    engineRef.current?.setVolume(v);
  }

  function toggleMute() {
    const next: Stored = { ...stored, muted: !stored.muted };
    setStored(next);
    saveStored(next);
    engineRef.current?.setVolume(next.muted ? 0 : next.volume);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50" data-no-print>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-2 px-1">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Now playing
                </div>
                <div className="truncate text-sm font-semibold">{preset.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {preset.description}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close music panel"
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={toggle}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground shadow"
                aria-label={playing ? "Pause music" : "Play music"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>
              <button
                onClick={toggleMute}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={stored.muted ? "Unmute" : "Mute"}
              >
                {stored.muted || stored.volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={stored.muted ? 0 : stored.volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-accent"
                aria-label="Volume"
              />
            </div>

            <div className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">
              Synthesised live in your browser — no streaming, zero data used.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => {
          setOpen((v) => !v);
          // First-tap to expand also doubles as a user gesture for audio,
          // so users only need one click to hit play afterwards.
        }}
        whileTap={{ scale: 0.94 }}
        className={`flex h-12 items-center gap-2 rounded-full border border-border bg-card/90 px-3 shadow-lg backdrop-blur-xl transition-colors hover:bg-card ${
          playing ? "ring-2 ring-accent/40" : ""
        }`}
        aria-expanded={open}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent/40 to-secondary/40 text-foreground">
          <Music2 className="h-4 w-4" />
        </span>
        <span className="hidden pr-1 text-xs font-medium sm:inline">
          {playing ? "Now playing" : "Vibe music"}
        </span>
        {playing && (
          <span className="flex items-end gap-0.5 pr-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ scaleY: 0.4 }}
                animate={{ scaleY: [0.4, 1, 0.4] }}
                transition={{ duration: 0.7 + i * 0.15, repeat: Infinity, ease: "easeInOut" }}
                className="h-3 w-0.5 origin-bottom rounded-full bg-accent"
              />
            ))}
          </span>
        )}
      </motion.button>
    </div>
  );
}
