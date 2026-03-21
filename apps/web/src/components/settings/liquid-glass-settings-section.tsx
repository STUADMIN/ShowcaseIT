'use client';

import { useLiquidGlassPrefs } from '@/hooks/use-liquid-glass-prefs';
import {
  LIQUID_GLASS_PRESETS,
  type BackgroundPattern,
  type LiquidGlassPreset,
  type PointerFollow,
  type SwirlSpeed,
} from '@/lib/ui/liquid-glass-prefs';

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-brand-600';

export function LiquidGlassSettingsSection() {
  const { prefs, setPrefs } = useLiquidGlassPrefs();

  const preset = LIQUID_GLASS_PRESETS[prefs.preset];

  return (
    <section className="card mb-6">
      <h3 className="text-lg font-semibold mb-2">Workspace background</h3>
      <p className="text-sm text-gray-500 mb-6">
        Visual effects for the main workspace (sidebar stays solid): liquid glass, grain, patterns, mesh drift,
        spotlight, scroll bar, card hovers, list motion, and success celebration. Saved in this browser only; changes
        apply immediately (system <strong className="text-gray-400">reduced motion</strong> disables mesh, stagger, and
        celebration).
      </p>

      <div className="space-y-6">
        <label className="flex items-center justify-between cursor-pointer gap-4">
          <div>
            <p className="text-sm font-medium text-gray-200">Liquid glass effect</p>
            <p className="text-xs text-gray-500">Turn off for a plain background across the app (sidebar stays solid)</p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              checked={prefs.effect === 'liquid'}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, effect: e.target.checked ? 'liquid' : 'none' }))
              }
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-gray-700 rounded-full peer-checked:bg-brand-600 transition-colors" />
            <div className="absolute top-1 left-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
          </div>
        </label>

        {prefs.effect === 'liquid' && (
          <>
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Color preset</label>
              <select
                value={prefs.preset}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, preset: e.target.value as LiquidGlassPreset }))
                }
                className={inputClass}
              >
                {(Object.keys(LIQUID_GLASS_PRESETS) as LiquidGlassPreset[]).map((key) => (
                  <option key={key} value={key}>
                    {LIQUID_GLASS_PRESETS[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Primary glow</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={prefs.primary ?? preset.primary}
                    onChange={(e) => setPrefs((p) => ({ ...p, primary: e.target.value }))}
                    className="h-10 w-14 rounded cursor-pointer border border-gray-600 bg-gray-900 shrink-0"
                    title="Primary color"
                  />
                  <input
                    type="text"
                    value={prefs.primary ?? ''}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        primary: e.target.value.trim() === '' ? null : e.target.value,
                      }))
                    }
                    placeholder={preset.primary}
                    className={`${inputClass} flex-1 font-mono text-xs`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, primary: null }))}
                  className="text-xs text-brand-400 hover:text-brand-300 mt-1.5"
                >
                  Reset to preset
                </button>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Secondary glow</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={prefs.secondary ?? preset.secondary}
                    onChange={(e) => setPrefs((p) => ({ ...p, secondary: e.target.value }))}
                    className="h-10 w-14 rounded cursor-pointer border border-gray-600 bg-gray-900 shrink-0"
                    title="Secondary color"
                  />
                  <input
                    type="text"
                    value={prefs.secondary ?? ''}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        secondary: e.target.value.trim() === '' ? null : e.target.value,
                      }))
                    }
                    placeholder={preset.secondary}
                    className={`${inputClass} flex-1 font-mono text-xs`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, secondary: null }))}
                  className="text-xs text-brand-400 hover:text-brand-300 mt-1.5"
                >
                  Reset to preset
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1.5">
                Intensity <span className="text-gray-600">({prefs.intensity}%)</span>
              </label>
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={prefs.intensity}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, intensity: Number(e.target.value) }))
                }
                className="w-full accent-brand-600"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Pointer follow</label>
              <p className="text-xs text-gray-600 mb-2">How the glass moves with your mouse in the main workspace</p>
              <select
                value={prefs.pointerFollow}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, pointerFollow: e.target.value as PointerFollow }))
                }
                className={inputClass}
              >
                <option value="smooth">Smooth — eased drift</option>
                <option value="snappy">Snappy — tight on the cursor</option>
                <option value="trailing">Trailing — liquid lag behind the cursor</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Swirl motion</label>
              <select
                value={prefs.swirlSpeed}
                onChange={(e) =>
                  setPrefs((p) => ({ ...p, swirlSpeed: e.target.value as SwirlSpeed }))
                }
                className={inputClass}
              >
                <option value="slow">Slow</option>
                <option value="medium">Medium</option>
                <option value="fast">Fast</option>
                <option value="off">Off (static glass)</option>
              </select>
            </div>
          </>
        )}

        <hr className="border-gray-800 my-8" />

        <h4 className="text-base font-semibold text-gray-200 mb-1">Ambient & texture</h4>
        <p className="text-xs text-gray-600 mb-4">Layered under liquid glass (or alone if glass is off).</p>

        <div className="space-y-5">
          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Film grain</p>
              <p className="text-xs text-gray-500">Subtle noise overlay (good for flat dark UIs)</p>
            </div>
            <Toggle
              checked={prefs.grainEnabled}
              onChange={(v) => setPrefs((p) => ({ ...p, grainEnabled: v }))}
            />
          </label>
          {prefs.grainEnabled && (
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">
                Grain strength <span className="text-gray-600">({prefs.grainOpacity}%)</span>
              </label>
              <input
                type="range"
                min={5}
                max={45}
                step={1}
                value={prefs.grainOpacity}
                onChange={(e) => setPrefs((p) => ({ ...p, grainOpacity: Number(e.target.value) }))}
                className="w-full accent-brand-600"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 block mb-1.5">Background pattern</label>
            <select
              value={prefs.backgroundPattern}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, backgroundPattern: e.target.value as BackgroundPattern }))
              }
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="dots">Dot grid</option>
              <option value="grid">Line grid</option>
            </select>
          </div>
          {prefs.backgroundPattern !== 'none' && (
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">
                Pattern visibility <span className="text-gray-600">({prefs.patternOpacity}%)</span>
              </label>
              <input
                type="range"
                min={8}
                max={50}
                step={1}
                value={prefs.patternOpacity}
                onChange={(e) => setPrefs((p) => ({ ...p, patternOpacity: Number(e.target.value) }))}
                className="w-full accent-brand-600"
              />
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Slow mesh drift</p>
              <p className="text-xs text-gray-500">Large blurred blobs using your glow colors</p>
            </div>
            <Toggle
              checked={prefs.meshDriftEnabled}
              onChange={(v) => setPrefs((p) => ({ ...p, meshDriftEnabled: v }))}
            />
          </label>
          {prefs.meshDriftEnabled && (
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">
                Mesh intensity <span className="text-gray-600">({prefs.meshIntensity}%)</span>
              </label>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={prefs.meshIntensity}
                onChange={(e) => setPrefs((p) => ({ ...p, meshIntensity: Number(e.target.value) }))}
                className="w-full accent-brand-600"
              />
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Cursor spotlight</p>
              <p className="text-xs text-gray-500">Brighter near the pointer, darker at the edges</p>
            </div>
            <Toggle
              checked={prefs.spotlightEnabled}
              onChange={(v) => setPrefs((p) => ({ ...p, spotlightEnabled: v }))}
            />
          </label>
          {prefs.spotlightEnabled && (
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">
                Spotlight strength <span className="text-gray-600">({prefs.spotlightStrength}%)</span>
              </label>
              <input
                type="range"
                min={15}
                max={70}
                step={1}
                value={prefs.spotlightStrength}
                onChange={(e) => setPrefs((p) => ({ ...p, spotlightStrength: Number(e.target.value) }))}
                className="w-full accent-brand-600"
              />
            </div>
          )}
        </div>

        <hr className="border-gray-800 my-8" />

        <h4 className="text-base font-semibold text-gray-200 mb-1">UI polish</h4>
        <div className="space-y-5">
          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Card hover glow</p>
              <p className="text-xs text-gray-500">Soft blue ring on .card / .card-hover</p>
            </div>
            <Toggle
              checked={prefs.cardHoverGlow}
              onChange={(v) => setPrefs((p) => ({ ...p, cardHoverGlow: v }))}
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Scroll progress bar</p>
              <p className="text-xs text-gray-500">Thin gradient line at the top of the main workspace</p>
            </div>
            <Toggle
              checked={prefs.scrollProgressBar}
              onChange={(v) => setPrefs((p) => ({ ...p, scrollProgressBar: v }))}
            />
          </label>
        </div>

        <hr className="border-gray-800 my-8" />

        <h4 className="text-base font-semibold text-gray-200 mb-1">Motion</h4>
        <div className="space-y-5">
          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">List entrance animations</p>
              <p className="text-xs text-gray-500">Fade-in on dashboard / guides / recordings lists (respects system reduced motion)</p>
            </div>
            <Toggle
              checked={prefs.listEntranceAnimations}
              onChange={(v) => setPrefs((p) => ({ ...p, listEntranceAnimations: v }))}
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer gap-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Celebrate on guide created</p>
              <p className="text-xs text-gray-500">Short burst when generation succeeds from Recordings / New recording</p>
            </div>
            <Toggle
              checked={prefs.celebrateOnSuccess}
              onChange={(v) => setPrefs((p) => ({ ...p, celebrateOnSuccess: v }))}
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-10 h-6 bg-gray-700 rounded-full peer-checked:bg-brand-600 transition-colors" />
      <div className="absolute top-1 left-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
    </div>
  );
}
