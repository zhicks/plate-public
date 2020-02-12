import {Directive, AfterViewInit, ElementRef, HostListener, Output, EventEmitter } from '@angular/core';

@Directive({ selector: '[textAreaAutoGrow]' })
export class TextAreaAutoGrowDirective implements AfterViewInit {

    @Output('heightListener')
    heightListener = new EventEmitter();

    private previousHeight = 0;

    constructor(
        private el: ElementRef
    ) {}

    @HostListener('input')
    resizeHeight() {
        const textArea = this.el.nativeElement;
        textArea.style.height = 'auto';
        if (this.previousHeight && this.heightListener) {
            let heightDifference = textArea.scrollHeight - this.previousHeight;
            this.heightListener.emit(heightDifference);
        }
        this.previousHeight = textArea.scrollHeight;
        textArea.style.height = `${textArea.scrollHeight}px`;
    }

    @HostListener('keyup', ['$event'])
    keyup(e: KeyboardEvent) {
        if (e && e.keyCode === 13) {
            e.preventDefault();
        }
    }

    ngAfterViewInit() {
        this.resizeHeight();
    }

}
