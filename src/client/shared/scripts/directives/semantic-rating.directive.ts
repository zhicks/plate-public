import {Directive, ElementRef, Output, AfterViewInit, EventEmitter} from '@angular/core';

interface SemanticJQuery extends JQuery {
    rating: Function;
}

@Directive({ selector: '[semanticRating]' })
export class SemanticRatingDirective implements AfterViewInit {

    @Output('onRate')
    onRate = new EventEmitter<number>();

    constructor(private el: ElementRef) {
    }

    ngAfterViewInit() {
        const $el: SemanticJQuery = <SemanticJQuery>$(this.el.nativeElement);
        $el.rating({
            onRate: (value) => {
                this.onRate.emit(value);
            }
        });
    }
}