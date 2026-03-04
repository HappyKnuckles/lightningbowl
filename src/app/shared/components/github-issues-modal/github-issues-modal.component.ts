import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentOutline, openOutline, warningOutline } from 'ionicons/icons';
import { GitHubIssue } from 'src/app/core/models/github-issue.model';
import { GitHubService } from 'src/app/core/services/github/github.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-github-issues-modal',
  templateUrl: './github-issues-modal.component.html',
  styleUrls: ['./github-issues-modal.component.scss'],
  imports: [
    IonTitle,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonAvatar,
    IonChip,
    IonIcon,
    IonSpinner,
    IonCardContent,
    IonCardTitle,
    IonCardHeader,
    IonCard,
    IonSelectOption,
    IonSelect,
    IonButton,
    IonContent,
    CommonModule,
    FormsModule,
    TranslateModule,
  ],
})
export class GithubIssuesModalComponent implements OnInit {
  modalCtrl = inject(ModalController);
  issues: GitHubIssue[] = [];
  loading = false;
  selectedLabels: string[] = ['']; // Empty array to show all issues by default
  error: string | null = null;

  constructor(
    private gitHubService: GitHubService,
    private translate: TranslateService,
  ) {
    addIcons({
      documentOutline,
      openOutline,
      warningOutline,
    });
  }

  ngOnInit(): void {
    this.loadIssues();
  }

  async loadIssues(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.issues = await this.gitHubService.getIssues(this.selectedLabels);
    } catch (error) {
      console.error('Failed to load issues:', error);
      this.issues = [];
      this.error = this.translate.instant('ISSUES.LOAD_ERROR');
    } finally {
      this.loading = false;
    }
  }

  onLabelFilterChange(): void {
    this.loadIssues();
  }

  getTruncatedBody(body: string): string {
    if (!body || body.length <= 200) {
      return body;
    }
    return body.substring(0, 200) + '...';
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return this.translate.instant('ISSUES.TIME_TODAY');
    } else if (diffInDays === 1) {
      return this.translate.instant('ISSUES.TIME_YESTERDAY');
    } else if (diffInDays < 7) {
      return this.translate.instant('ISSUES.TIME_DAYS_AGO', { count: diffInDays });
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return this.translate.instant('ISSUES.TIME_WEEKS_AGO', { count: weeks });
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return this.translate.instant('ISSUES.TIME_MONTHS_AGO', { count: months });
    } else {
      const years = Math.floor(diffInDays / 365);
      return this.translate.instant('ISSUES.TIME_YEARS_AGO', { count: years });
    }
  }

  getTextColor(backgroundColor: string): string {
    // Convert hex to RGB
    const r = parseInt(backgroundColor.substring(0, 2), 16);
    const g = parseInt(backgroundColor.substring(2, 4), 16);
    const b = parseInt(backgroundColor.substring(4, 6), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // No need for cancel method since modal is controlled by parent
}
