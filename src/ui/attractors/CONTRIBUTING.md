# Adding a New Attractor

Follow these 11 steps to add a new attractor to the launcher system.

## Steps

1. **Backend Model** — Add a Pydantic class to `memox_hub/embed_app/launcher_config.py`
   - Extend the `Attractors` model with your new attractor
   - Example: `class MyAttractor(BaseModel): enabled: bool = False`

2. **Variant Tagger** — Update `memox_hub/embed_app/variant_tagger.py`
   - Add your attractor tag (e.g., `"my_attractor"`) to the variant string derivation
   - Tags are alphabetically sorted so the variant string is deterministic

3. **TypeScript Interface** — Add to `src/config/types.ts`
   - Define the interface (e.g., `export interface MyAttractor { enabled?: boolean }`)
   - Add it to the `Attractors` union type
   - Document in JSDoc what each field does

4. **Default Config** — Add to `src/config/defaults.ts`
   - Set sensible defaults (e.g., `my_attractor: { enabled: false }`)
   - Merged with server config, so optional fields are safe

5. **Attractor Renderer** — Create `src/ui/attractors/<name>.ts`
   - Export a function returning `AttractorHandle` from `./types.ts`
   - Handle: `{ mount(): HTMLElement, destroy(): void, isVisible(): boolean }`
   - `mount()` creates the DOM tree; `destroy()` cleans up listeners/timers
   - `isVisible()` returns true if the attractor is currently rendered

6. **Unit Tests** — Create `src/ui/attractors/<name>.test.ts`
   - Minimum 3 tests: mount (renders), cleanup (no memory leaks), disabled-when-false
   - Use the helpers in `test/vitest-setup.ts` (e.g., `cleanupDOM()`)

7. **Precedence Rules** — If your attractor conflicts with another, update `src/ui/attractors/pick-primary.ts`
   - Add a rule with priority (first match wins)
   - Example: "persona takes priority; if persona disabled, show teaser"
   - Document the rule in the comment block at the top of `pick-primary.ts`
   - Only affects PRIMARY attractors (teaser, persona); badge/pulse/smart_auto_open are independent

8. **Mount in Bootstrap** — Update `src/index.ts`
   - Push the attractor handle onto the `mountedAttractors[]` array
   - Example: `mountedAttractors.push(teaserHandle);`
   - This ensures `destroy()` is called when the widget shuts down

9. **Admin UI — Backend Form** — Add section to `mmx-unified-chat/components/app/views/agents/sections/LauncherAttractorSection.tsx`
   - Checkbox or form inputs for your attractor config
   - Mirrors the TypeScript interface from step 3

10. **Admin UI — Preview** — Add preview block to `LauncherPreview.tsx`
    - Show a mockup of how the attractor looks on the launcher
    - Used by the product team to verify design

11. **DX Verification** — Run the checklist in `docs/specs/embed-app/dx-verification-checklist.md`
    - Update `DEFAULT_LAUNCHER` in all 3 repos (memox-hub, ChatEmbed_V2, mmx-unified-chat)
    - Verify `npm test` passes (no regressions)
    - Verify `npm run build` succeeds (bundle includes your code)
    - Test in the admin UI: toggle on/off, check PostHog events
