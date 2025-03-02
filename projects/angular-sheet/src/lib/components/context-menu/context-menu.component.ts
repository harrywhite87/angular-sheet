import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../services/state.service';
import { ClipboardService } from '../../services/clipboard.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  imports: [CommonModule],
  standalone: true
})
export class ContextMenuComponent {
  public stateService = inject(StateService);
  public clipboardService = inject(ClipboardService);
  public dataService = inject(DataService);

  public hideContextMenu(): void {
    this.stateService.updateContextMenuState({ visible: false });
  }

  public onCopyClick(): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;
    this.hideContextMenu();
    this.clipboardService.copySelection(sheet);
  }

  public onPasteClick(): void {
    const sheet = this.dataService.getSheetData();
    if (!sheet) return;
    this.hideContextMenu();
    this.clipboardService.pasteSelection(sheet);
  }

}
