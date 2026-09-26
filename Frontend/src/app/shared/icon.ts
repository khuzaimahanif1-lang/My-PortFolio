import { Component, Input, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { LucideArrowUpRight, LucideArrowRight, LucideArrowDown, LucideLayoutDashboard,
  LucideFolder, LucideCheckSquare, LucideNotebookPen, LucideChartNoAxesCombined,
  LucideMessageCircle, LucideBell, LucideTarget, LucideUser, LucideSettings,
  LucideLogOut, LucideLock, LucideSearch, LucidePlus, LucideX, LucideMenu, LucideChevronLeft,
  LucideChevronRight, LucideChevronDown, LucidePanelLeftClose, LucidePanelLeftOpen, LucideSparkles, LucideCode, LucideBrain, LucideDownload, LucideSend,
  LucideImage, LucideTrash2, LucidePencil, LucideCheck, LucidePin, LucideStar, LucideArchive,
  LucidePhone, LucideVideo, LucideMonitor, LucideMic, LucideMicOff, LucideVideoOff, LucidePhoneOff, LucideCopy, LucideMousePointer2,
  LucideExternalLink, LucideMail, LucideShield, LucideGlobe, LucideClock } from '@lucide/angular';
@Component({selector: 'app-icon', imports: [NgComponentOutlet], host: {'aria-hidden': 'true', class: 'icon'},
  template: '<ng-container *ngComponentOutlet="component; inputs: inputs" />'})
export class Icon {
  @Input() name = 'sparkles'; @Input() size = 19;
  private map: Record<string, Type<unknown>> = {arrow: LucideArrowUpRight, right: LucideArrowRight, down: LucideArrowDown,
    dashboard: LucideLayoutDashboard, projects: LucideFolder, tasks: LucideCheckSquare, notes: LucideNotebookPen,
    reports: LucideChartNoAxesCombined, analytics: LucideChartNoAxesCombined, messages: LucideMessageCircle, notifications: LucideBell,
    goals: LucideTarget, account: LucideUser, settings: LucideSettings, logout: LucideLogOut, lock: LucideLock,
    search: LucideSearch, plus: LucidePlus, close: LucideX, menu: LucideMenu, left: LucideChevronLeft,
    chevron: LucideChevronRight, chevronDown: LucideChevronDown, panelClose: LucidePanelLeftClose, panelOpen: LucidePanelLeftOpen, sparkles: LucideSparkles, code: LucideCode, brain: LucideBrain,
    phone: LucidePhone, video: LucideVideo, desktop: LucideMonitor, mic: LucideMic, micOff: LucideMicOff, videoOff: LucideVideoOff, hangup: LucidePhoneOff, copy: LucideCopy, pointer: LucideMousePointer2,
    download: LucideDownload, send: LucideSend, image: LucideImage, trash: LucideTrash2, edit: LucidePencil,
    check: LucideCheck, pin: LucidePin, star: LucideStar, archive: LucideArchive, github: LucideCode,
    external: LucideExternalLink, mail: LucideMail, shield: LucideShield, globe: LucideGlobe, clock: LucideClock};
  get component() { return this.map[this.name] || this.map['sparkles']; }
  get inputs() { return {size: this.size, strokeWidth: 1.7}; }
}


