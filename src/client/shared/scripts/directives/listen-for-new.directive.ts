import {Directive, ElementRef, Output, AfterViewInit, EventEmitter} from '@angular/core';

@Directive({ selector: '[listenForNew]' })
export class ListenForNewDirective implements AfterViewInit {
    @Output()
    onNew = new EventEmitter();

    constructor(private el: ElementRef) {

    }

    ngAfterViewInit() {
        const $el = $(this.el.nativeElement);
        this.onNew.emit($el);
    }
}