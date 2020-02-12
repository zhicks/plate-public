import { NgModule }       from '@angular/core';
import { BrowserModule  } from '@angular/platform-browser';
import { AppComponent }   from './app.component';

const PROVIDERS = [

]

const DECLARATIONS = [
    AppComponent
]

@NgModule({
    declarations: DECLARATIONS,
    imports:      [BrowserModule],
    bootstrap:    [AppComponent],
    providers: PROVIDERS
})
export class AppModule { }