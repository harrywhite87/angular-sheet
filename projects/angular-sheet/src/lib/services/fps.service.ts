import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class FpsService implements OnDestroy {
  private frameCount = 0;
  private lastFpsUpdateTime = 0;
  private fpsUpdateInterval = 1000; // Update FPS every second
  private fpsSubject = new BehaviorSubject<number>(0);
  private animationFrameId: number | null = null;
  private continuousUpdateEnabled = true;

  // Add a timestamp buffer to calculate a moving average
  private frameTimestamps: number[] = [];
  private readonly maxFrameHistory = 60;

  private readonly inactivityResetDelay = 500; // ms before resetting FPS to 0 when idle

  public fps$ = this.fpsSubject.asObservable();



  private lastResetTime = 0;
  private activeRenders = false;
  private inactivityTimeout: number | null = null;


  constructor() {
    this.lastResetTime = performance.now();
  }

  trackFrame(): void {
    // Clear any pending timeout that would reset FPS to 0
    if (this.inactivityTimeout !== null) {
      window.clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }

    // Mark that we have active rendering
    this.activeRenders = true;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastResetTime;

    // Update FPS counter approximately every second
    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      this.fpsSubject.next(fps);
      this.frameCount = 0;
      this.lastResetTime = now;
    }

    // Set a timeout to reset FPS to 0 if no more frames are tracked
    this.inactivityTimeout = window.setTimeout(() => {
      if (this.activeRenders) {
        this.activeRenders = false;
        this.fpsSubject.next(0);
      }
    }, this.inactivityResetDelay);
  }

  /**
   * Starts continuous FPS updates that will run even when no frames are rendered
   */
  private startContinuousUpdate(): void {
    const updateLoop = (timestamp: number) => {
      if (!this.continuousUpdateEnabled) return;

      const now = timestamp;

      // Update FPS value if enough time has passed
      if (now - this.lastFpsUpdateTime >= this.fpsUpdateInterval) {
        // Calculate more accurate FPS using moving average of frame timestamps
        let currentFps = this.calculateFps();

        this.fpsSubject.next(currentFps);

        // Reset for next interval
        this.frameCount = 0;
        this.lastFpsUpdateTime = now;

        // Clear old frame timestamps older than the update interval
        const cutoffTime = now - this.fpsUpdateInterval;
        this.frameTimestamps = this.frameTimestamps.filter(ts => ts >= cutoffTime);
      }

      this.animationFrameId = requestAnimationFrame(updateLoop);
    };

    this.animationFrameId = requestAnimationFrame(updateLoop);
  }

  /**
   * Calculate FPS based on the timestamps of recent frames
   */
  private calculateFps(): number {
    if (this.frameTimestamps.length < 2) {
      return this.frameCount; // Fall back to simple count if not enough data
    }

    // Sort timestamps (they should already be in order, but to be safe)
    const sortedTimestamps = [...this.frameTimestamps].sort((a, b) => a - b);

    // Calculate time span
    const timeSpan = (sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0]) / 1000;

    // Return 0 if timeSpan is too small to avoid division by zero
    if (timeSpan < 0.001) return 0;

    // Calculate frames per second (subtract 1 from length because we're measuring intervals)
    const framesPerSec = (sortedTimestamps.length - 1) / timeSpan;

    return Math.round(framesPerSec);
  }

  /**
   * Stop continuous FPS monitoring
   */
  public stopContinuousUpdate(): void {
    this.continuousUpdateEnabled = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  ngOnDestroy(): void {
    this.stopContinuousUpdate();
  }
}