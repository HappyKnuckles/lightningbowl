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
  ],
})
export class GithubIssuesModalComponent implements OnInit {
  modalCtrl = inject(ModalController);
  issues: GitHubIssue[] = [];
  loading = false;
  selectedLabels: string[] = ['']; // Empty array to show all issues by default
  error: string | null = null;

  constructor(private gitHubService: GitHubService) {
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
      this.error =
        'Unable to load issues. This may be due to network restrictions or API limitations. Please visit the GitHub repository directly for the latest issues.';
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
      return 'today';
    } else if (diffInDays === 1) {
      return 'yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
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
