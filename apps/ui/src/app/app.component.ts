import { Component } from '@angular/core'
import { AppShellComponent } from './features/shell/app-shell.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  template: '<acta-app-shell></acta-app-shell>',
})
export class AppComponent {}
