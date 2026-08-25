import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSegmentContent,
  IonSegmentView,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, flash, wifiOutline, notifications, phonePortrait, download, shareOutline, checkmark, add, checkmarkCircle } from 'ionicons/icons';

@Component({
  selector: 'app-pwa-install-prompt',
  templateUrl: './pwa-install-prompt.component.html',
  styleUrls: ['./pwa-install-prompt.component.scss'],
  imports: [
    IonLabel,
    IonSegmentButton,
    IonSegment,
    IonModal,
    IonSegmentContent,
    IonSegmentView,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
  ],
})
export class PwaInstallPromptComponent implements OnInit {
  @Input() isOpen = false;
  @Input() canInstall = false;
  @Output() install = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();
  presentingElement!: HTMLElement | null;

  isChrome = false;
  isIOS = false;
  images = [
    {
      src: 'assets/screenshots/games/score-entry.png',
      alt: 'Pin-by-pin input',
      name: 'Track',
      id: 'pin-input-screen',
      caption: 'Track games pin by pin',
      index: 0,
    },
    {
      src: 'assets/screenshots/statistics/overall.png',
      alt: 'Statistics',
      name: 'Stats',
      id: 'stats-screen',
      caption: 'View detailed stats',
      index: 1,
    },
    {
      src: 'assets/screenshots/statistics/spares.png',
      alt: 'Spare & pin stats',
      name: 'Spares',
      id: 'spare-screen',
      caption: 'Analyze spares',
      index: 2,
    },
    {
      src: 'assets/screenshots/statistics/pins.png',
      alt: 'Leave stats',
      name: 'Leaves',
      id: 'pin-screen',
      caption: 'View detailed leave info',
      index: 3,
    },
    {
      src: 'assets/screenshots/games/game-details.png',
      alt: 'Game history',
      name: 'History',
      id: 'history-screen',
      caption: 'Browse game history',
      index: 4,
    },
    { src: 'assets/screenshots/leagues/list.png', alt: 'Leagues', name: 'Leagues', id: 'leagues-screen', caption: 'Follow your leagues', index: 5 },
    {
      src: 'assets/screenshots/equipment/arsenal.png',
      alt: 'Your arsenal',
      name: 'Arsenal',
      id: 'arsenal-screen',
      caption: 'Manage your arsenal',
      index: 6,
    },
    {
      src: 'assets/screenshots/equipment/ball-library.png',
      alt: 'Ball library',
      name: 'Balls',
      id: 'balls-screen',
      caption: 'Explore the ball library',
      index: 7,
    },
    {
      src: 'assets/screenshots/patterns/library.png',
      alt: 'Oil patterns',
      name: 'Patterns',
      id: 'pattern-screen',
      caption: 'Discover oil patterns',
      index: 8,
    },
  ];
  selectedImage = 'pin-input-screen';
  currentImageIndex = 0;
  isModalOpen = false;
  constructor() {
    addIcons({
      close,
      flash,
      wifiOutline,
      notifications,
      phonePortrait,
      download,
      shareOutline,
      checkmark,
      add,
      checkmarkCircle,
    });
  }

  ngOnInit(): void {
    this.detectBrowser();
    this.presentingElement = document.querySelector('.ion-page');
  }

  onInstall(): void {
    this.install.emit();
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onSegmentChange(event: any): void {
    const selectedId = event.detail.value;
    const selectedImage = this.images.find((image) => image.id === selectedId);
    if (selectedImage) {
      this.selectedImage = selectedImage.id;
      this.currentImageIndex = selectedImage.index;
    }
  }

  openImageModal(image: string): void {
    this.isModalOpen = true;

    setTimeout(() => {
      this.selectedImage = image;
      this.currentImageIndex = this.images.findIndex((img) => img.id === image);
    }, 50);
  }

  private detectBrowser(): void {
    const userAgent = navigator.userAgent;
    // More precise Chrome/Chromium/Edge detection that excludes Safari
    this.isChrome =
      (/Chrome|Chromium|Edg/.test(userAgent) && !/Safari\/[0-9]/.test(userAgent)) ||
      (/Chrome/.test(userAgent) && /Safari/.test(userAgent) && !/Mobile.*Safari/.test(userAgent));

    // Precise iOS Safari detection - iOS device with Safari but not Chrome/Firefox/Edge on iOS
    this.isIOS = /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent); // Exclude Chrome, Firefox, Edge, Opera on iOS
  }
}
