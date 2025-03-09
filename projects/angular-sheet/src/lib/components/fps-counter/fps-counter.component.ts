import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'fps-counter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fps-counter fps-good" >
      {{ fps }} FPS
    </div>
  `,
  styles: [`
    .fps-counter {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
      z-index: 10000;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      pointer-events: none;
    }
    
    .fps-good {
      background-color: rgba(0, 128, 0, 0.7);
    }
    
    .fps-warning {
      background-color: rgba(255, 165, 0, 0.7);
    }
    
    .fps-critical {
      background-color: rgba(255, 0, 0, 0.7);
    }
  `]
})
export class FpsCounterComponent {
  @Input() fps: number = 0;

  // getFpsClass(value: number): string {
  //   if (value === 0) return 'fps-good';
  //   if (value >= 45) return 'fps-good';
  //   if (value >= 30) return 'fps-warning';
  //   return 'fps-critical';
  // }
}