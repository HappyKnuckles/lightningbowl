import { Injectable, signal, inject } from '@angular/core';
import { ToastService } from '../toast/toast.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private toastService = inject(ToastService);

  #username = signal<string>('');
  get username() {
    return this.#username;
  }

  constructor() {
    const storedName = localStorage.getItem('username') || '';
    this.#username.set(storedName);
  }

  setUsername(username: string): void {
    const newName = this.capitalizeFirstLetter(username);
    if (this.#username() !== newName && newName.trim() !== '') {
      localStorage.setItem('username', newName);
      this.#username.set(newName);
      this.toastService.showToast(`Name updated to ${newName}`, 'reload-outline');
    }
  }

  capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
