import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from '../toast/toast.service';
import { ToastMessages } from '../../constants/toast-messages.constants';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  #username = signal<string>('');
  get username() {
    return this.#username;
  }

  constructor(
    private toastService: ToastService,
    private translate: TranslateService,
  ) {
    const storedName = localStorage.getItem('username') || '';
    this.#username.set(storedName);
  }

  setUsername(username: string): void {
    const newName = this.capitalizeFirstLetter(username);
    if (this.#username() !== newName && newName.trim() !== '') {
      localStorage.setItem('username', newName);
      this.#username.set(newName);
      this.toastService.showToast(this.translate.instant(ToastMessages.nameUpdated, { name: newName }), 'reload-outline');
    }
  }

  capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
