import {Directive, ElementRef, Input, AfterViewInit} from '@angular/core';

@Directive({ selector: '[plateHorizontalScroll]' })
export class PlateHorizontalScrollDirective implements AfterViewInit {
    constructor(private el: ElementRef) {

    }

    ngAfterViewInit() {
        const $el = $(this.el.nativeElement);
        (<any>$el).mousewheel(function(event, delta) {
            //console.log(event);
            // Any element with attribute p-sch on it will scroll horizontally if hovering
            // p-sch being plate-scroll-horizontal
            if (event.target.attributes['p-sch']) {
                this.scrollLeft -= (delta * 30);
            }
        });
    }
}