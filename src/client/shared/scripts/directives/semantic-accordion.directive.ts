import {Directive, ElementRef, Input, AfterViewInit} from '@angular/core';

interface SemanticJQuery extends JQuery {
    accordion: Function;
}

@Directive({ selector: '[semanticAccordion]' })
export class SemanticAccordionDirective implements AfterViewInit {

    @Input()
    semanticAccordion: string;

    constructor(private el: ElementRef) {

    }

    ngAfterViewInit() {
        const $el: SemanticJQuery = <SemanticJQuery>$(this.el.nativeElement);
        $el.accordion();
    }
}