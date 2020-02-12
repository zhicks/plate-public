import {Directive, ElementRef, Input, AfterViewInit} from '@angular/core';

interface SemanticJQuery extends JQuery {
    dropdown: Function;
}

@Directive({ selector: '[semanticDropdown]' })
export class SemanticDropdownDirective implements AfterViewInit {

    @Input()
    semanticDropdown: string; // The action, for now

    constructor(private el: ElementRef) {

    }

    ngAfterViewInit() {
        let action: any = 'hide';
        let dontHideAutomatically = false;
        if (this.semanticDropdown) {
            action = 'nothing'
            dontHideAutomatically = true;
        }
        const $el: SemanticJQuery = <SemanticJQuery>$(this.el.nativeElement);
        $el.dropdown({
            action: action,
            keepOnScreen: true,
            silent: true,
            dontHideAutomatically: dontHideAutomatically
        });
    }
}