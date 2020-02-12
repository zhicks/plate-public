import {Directive, ElementRef, Input, AfterViewInit} from '@angular/core';

interface SemanticJQuery extends JQuery {
    popup: Function;
}

@Directive({ selector: '[semanticPopup]' })
export class SemanticPopupDirective implements AfterViewInit {

    @Input('semanticPopup')
    semanticPopup: string;

    @Input('useHtml')
    useHtml: boolean;

    @Input('bind')
    bind: string;

    constructor(private el: ElementRef) {
    }

    private setPopup() {
        setTimeout(() => {
            const $el: SemanticJQuery = <SemanticJQuery>$(this.el.nativeElement);
            let obj:any = { content: this.semanticPopup };
            if (this.useHtml) {
                obj.html = this.semanticPopup;
            } else if (this.bind) {
                obj.content = this.bind;
            }
            obj.variation = 'mini inverted';
            obj.delay = 200;
            $el.popup(obj);
        }, 500)
    }

    ngOnChanges() {
        this.setPopup();
    }

    ngAfterViewInit() {
        this.setPopup();
    }
}