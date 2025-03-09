import {
  Component,
  Input,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnChanges,
  SimpleChanges,
  HostListener,
  OnDestroy,
  inject,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Sheet, Debug } from '../../models/sheet.model';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { StateService, MouseMode } from '../../services/state.service';
import { RenderService } from '../../services/render.service';
import { EventService } from '../../services/event.service';
import { AnimationService } from '../../services/animation.service';
import { DataService } from '../../services/data.service';
import { ClipboardService } from '../../services/clipboard.service';
import { FpsService } from '../../services/fps.service';
import { FpsCounterComponent } from '../fps-counter/fps-counter.component';

@Component({
  selector: 'sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ContextMenuComponent, FpsCounterComponent],
  templateUrl: './sheet.component.html',
  styleUrls: ['./sheet.component.scss'],
  providers: [
    StateService,
    RenderService,
    EventService,
    AnimationService,
    DataService,
    ClipboardService,
    FpsService,
  ],
})

export class SheetComponent implements AfterViewInit, OnChanges, OnDestroy {
  public stateService = inject(StateService);
  private renderService = inject(RenderService);
  private eventService = inject(EventService);
  private animationService = inject(AnimationService);
  private dataService = inject(DataService);
  private fpsService = inject(FpsService);

  @Input() sheetData?: Sheet;
  @Input() debug: Debug = {
    showFpsCounter: false
  };
  @Output() sheetDataChange = new EventEmitter<Sheet>();
  @Output() fpsUpdate = new EventEmitter<number>();

  public currentFps = 0;

  private destroy$ = new Subject<void>();

  @ViewChild('sheetCanvas', { static: true })
  sheetCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sheetInput', { static: true })
  sheetInput!: ElementRef<HTMLInputElement>;
  @ViewChild('scrollContainer', { static: true })
  scrollContainer!: ElementRef<HTMLDivElement>;

  private subscriptions: Subscription[] = [];
  private scrollX = 0;
  private scrollY = 0;

  // Lifecycle hooks
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sheetData'] && this.sheetData) {
      this.dataService.setSheetData(this.sheetData);
      this.renderService.initCanvasSize(
        this.sheetCanvas.nativeElement,
        this.sheetData
      );
      this.renderService.markDirty();
    }
  }

  ngAfterViewInit(): void {
    if (!this.sheetData) return;
    this.addRowsAndColumns();
    this.renderService.setCanvas(
      this.sheetCanvas.nativeElement,
      this.scrollContainer.nativeElement
    );
    this.dataService.setSheetData(this.sheetData);
    this.stateService.setInputElement(this.sheetInput.nativeElement);
    this.renderService.initCanvasSize(
      this.sheetCanvas.nativeElement,
      this.sheetData
    );


    // Set up the markDirty function for the animation service
    this.animationService.setMarkDirtyFunction(() => {
      this.renderService.markDirty();
    });

    this.renderService.markDirty();

    this.startAnimation();

    this.dataService.sheetChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sheet) => {
        if (sheet) {
          this.sheetDataChange.emit(sheet);
          // When data changes, we need to redraw
          this.renderService.markDirty();
        }
      });

    // Subscribe to FPS updates
    this.fpsService.fps$
      .pipe(takeUntil(this.destroy$))
      .subscribe((fps) => {
        this.currentFps = fps;
        this.fpsUpdate.emit(fps);
      });
  }

  ngOnDestroy(): void {
    this.animationService.stopAnimation();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private addRowsAndColumns(): void {
    if (!this.sheetData) return;

    this.sheetData.cells.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        cell.rowIndex = rowIndex;
        cell.columnIndex = colIndex;
      });
    });
  }

  // Event handlers
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;

    this.eventService.onKeyDown(event, sheet);
    this.renderService.requestRender();
  }

  @HostListener('document:mousedown', ['$event'])
  handleOutsideClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.id === 'sheet-input') return;
    this.stateService.updateInputState({ disabled: true });
  }

  @HostListener('document:mouseup', ['$event'])
  handleMouseUp(): void {
    if (
      this.stateService.mouseMode === MouseMode.RESIZING_COLUMN ||
      this.stateService.mouseMode === MouseMode.RESIZING_ROW
    ) {
      this.stateService.setMouseMode(MouseMode.DEFAULT);
      this.stateService.updateResizeState({});
      this.renderService.requestRender();
    } else if (this.stateService.mouseMode === MouseMode.SELECTING_CELLS) {
      this.stateService.setMouseMode(MouseMode.DEFAULT);
    }
  }

  public onMouseDown(event: MouseEvent): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;

    this.eventService.onMouseDown(event, sheet);
    this.renderService.requestRender();
  }

  public onMouseUp(event: MouseEvent): void {
    this.eventService.onMouseUp();
    this.renderService.requestRender();
  }

  public onDblClick(event: MouseEvent): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;
    this.eventService.onDoubleClick(sheet, this.sheetInput);
  }

  public onMouseMove(event: MouseEvent): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;
    this.eventService.onMouseMove(event, sheet);
  }

  public onInputBlur(): void {
    this.stateService.updateInputState({ disabled: true });
  }

  public onInputChange(): void {
    if (!this.stateService.activeCell) return;

    const sheet = this.dataService.getSheetData();
    if (!sheet) return;

    const { row, col } = this.stateService.selection.start;
    this.dataService.updateCellValues(row, col, this.stateService.input.value);
    this.renderService.requestRender();
  }

  public onScroll(): void {
    const containerEl = this.scrollContainer.nativeElement;
    this.scrollX = containerEl.scrollLeft;
    this.scrollY = containerEl.scrollTop;
    this.stateService.updateScrollPosition(this.scrollX, this.scrollY);
    this.renderService.requestRender();
  }

  public onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.stateService.updateContextMenuState({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
    });
  }

  // Animation and rendering
  private startAnimation(): void {
    this.animationService.startAnimation(() =>
      this.renderService.requestRender()
    );
  }
}
