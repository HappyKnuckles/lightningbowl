import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    CommonModule,
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
    { src: 'assets/screenshots/start.png', alt: 'Start Screen', name: 'Start', id: 'start-screen', index: 0 },
    { src: 'assets/screenshots/stats.png', alt: 'Stats Screen', name: 'Stats', id: 'stats-screen', index: 1 },
    { src: 'assets/screenshots/history.png', alt: 'History Screen', name: 'History', id: 'history-screen', index: 2 },
    { src: 'assets/screenshots/arsenal.png', alt: 'Arsenal Screen', name: 'Arsenal', id: 'arsenal-screen', index: 3 },
    { src: 'assets/screenshots/balls.png', alt: 'Balls Screen', name: 'Balls', id: 'balls-screen', index: 4 },
    { src: 'assets/screenshots/pattern.png', alt: 'Pattern Screen', name: 'Pattern', id: 'pattern-screen', index: 5 },
  ];
  selectedImage = 'start-screen';
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

  private detectBrowser(): void {
    const userAgent = navigator.userAgent;
    // More precise Chrome/Chromium/Edge detection that excludes Safari
    this.isChrome =
      (/Chrome|Chromium|Edg/.test(userAgent) && !/Safari\/[0-9]/.test(userAgent)) ||
      (/Chrome/.test(userAgent) && /Safari/.test(userAgent) && !/Mobile.*Safari/.test(userAgent));

    // Precise iOS Safari detection - iOS device with Safari but not Chrome/Firefox/Edge on iOS
    this.isIOS = /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent); // Exclude Chrome, Firefox, Edge, Opera on iOS
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
    this.selectedImage = image;
    this.currentImageIndex = this.images.findIndex((img) => img.id === image);
    this.isModalOpen = true;
  }
}
