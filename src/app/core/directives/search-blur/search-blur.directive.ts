import { Directive, ElementRef, HostListener } from '@angular/core';
import { Keyboard } from '@capacitor/keyboard';
import { IonSearchbar } from '@ionic/angular';

@Directive({
  selector: '[appSearchBlur]',
  standalone: true,
})
export class SearchBlurDirective {
  constructor(private el: ElementRef<any>) {}

  @HostListener('keydown.enter', ['$event'])
  onEnterKeyDown(event: Event): void {
    // Ensure the directive is applied to an ion-searchbar or its input
    let inputElement: HTMLInputElement | undefined;

    if (this.el.nativeElement instanceof HTMLInputElement) {
      inputElement = this.el.nativeElement as HTMLInputElement;
    } else if (this.el.nativeElement.tagName === 'ION-SEARCHBAR') {
      // If it's an IonSearchbar component, get its input element
      const searchbarComponent = this.el.nativeElement as IonSearchbar;
      // IonSearchbar's getInputElement returns a Promise
      searchbarComponent
        .getInputElement()
        .then((input) => {
          input.blur();
          Keyboard.hide();
        })
        .catch((err) => console.error('Could not get input element from IonSearchbar', err));
      return; // Return early as getInputElement is async
    } else {
      // Try to find an input element within the host
      inputElement = this.el.nativeElement.querySelector('input');
    }

    if (inputElement) {
      inputElement.blur();
      Keyboard.hide();
      // Optionally prevent default form submission if enter is pressed on an input within a form
      event.preventDefault();
    }
  }
}
