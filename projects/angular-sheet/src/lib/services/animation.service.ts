import { Injectable, OnDestroy } from '@angular/core';
import { StateService } from './state.service';

@Injectable()
export class AnimationService implements OnDestroy {
  private dashOffset = 0;
  private animating = false;
  private frameId = 0;
  private previousShowMarchingAnts = false;
  private lastFrameTime = 0;

  // Animation configuration
  private FPS = 10;           // Frames per second
  private frameInterval = 1000 / this.FPS;  // Time between frames in ms
  private dashOffsetIncrement = 1;    // How much to move the dash each frame

  constructor(private stateService: StateService) { }

  startAnimation(onFrame: () => void): void {
    if (this.animating) return;

    this.animating = true;
    this.lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.animating) return;

      // Calculate time elapsed since last frame
      const elapsed = currentTime - this.lastFrameTime;

      const currentShowMarchingAnts = this.stateService.showMarchingAnts;

      // Only update if enough time has passed and marching ants are visible
      if (currentShowMarchingAnts && elapsed >= this.frameInterval) {
        // Update dash offset
        this.dashOffset = (this.dashOffset + this.dashOffsetIncrement);

        // Request redraw
        onFrame();

        // Update last frame time, accounting for any dropped frames
        this.lastFrameTime = currentTime - (elapsed % this.frameInterval);
      }

      this.previousShowMarchingAnts = currentShowMarchingAnts;
      this.frameId = requestAnimationFrame(animate);
    };

    this.frameId = requestAnimationFrame(animate);
  }

  // Allow external configuration of animation speed
  setFPS(fps: number) {
    if (fps > 0) {
      this.FPS = fps;
      this.frameInterval = 1000 / fps;
    }
  }

  // Allow external configuration of dash movement speed
  setDashIncrement(increment: number) {
    this.dashOffsetIncrement = increment;
  }

  stopAnimation(): void {
    this.animating = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  getDashOffset(): number {
    return this.dashOffset;
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }
}