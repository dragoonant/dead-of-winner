// How many frames the 3D canvas has rendered (the demand frameloop only renders when something asks). Read by the `?test=1` hook so the e2e
// can prove that Low graphics leaves the canvas idle and that High graphics only redraws at the effects' throttled rate.
let frames = 0
export const bumpFrame = (): void => { frames++ }
export const frameCount = (): number => frames
