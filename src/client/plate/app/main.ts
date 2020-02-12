import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule }              from './app.module';

(<any>window).PLATEDEBUG = {};

enableProdMode();
platformBrowserDynamic().bootstrapModule(AppModule);
