import {Directive, ElementRef, Input, AfterViewInit} from '@angular/core';

@Directive({ selector: '[plateStickIfScrollPast]' })
export class PlateStickIfScrollPastDirective implements AfterViewInit {

    @Input('plateStickIfScrollPast')
    plateStickIfScrollPast: any; // HTML Element

    constructor(private el: ElementRef) {

    }

    ngAfterViewInit() {
        let currentlyFixed = false;
        let $heightPlaceholderEl: JQuery = null;
        const $el = $(this.el.nativeElement);
        const $nextToEl = $el.next();
        const $stickToIfScrollPast = $(this.plateStickIfScrollPast);
        $stickToIfScrollPast.on('scroll', function(event) {
            const elHeight = $el.outerHeight();
            const offsetTop = $(this).offset().top;
            const nextToElOffsetTop = $nextToEl.offset().top;

            // If this is true, we should stick - unless we're past a certain point, like the bottom of the mail
            const shouldFix = offsetTop > nextToElOffsetTop - elHeight;

            // Without a bit of modifying, the header sticks around just a little too long
            const modifier = 1.8;

            const isPastFixedThreshold = offsetTop > nextToElOffsetTop - elHeight*modifier + $el.parent().outerHeight();

            if (shouldFix && !isPastFixedThreshold) {
                if (!currentlyFixed) {
                    // Create an element of exact size where this was so it doesn't jump
                    $heightPlaceholderEl = $(`<div style="min-width:1px; height:${elHeight}px"></div>`);
                    $el.after($heightPlaceholderEl);
                    $el.css('position', 'fixed');
                    // NOTE - For now we just grab the sibling. Will fix later by passing in what el we want to be under
                    $el.css('top', $(this).prev().outerHeight());
                    // NOTE - Yes, this is exactly a one time solution that we'll fix later
                    $el.css('width', 'calc(100% - 1.3rem)');
                    currentlyFixed = true;
                }
            } else {
                if (currentlyFixed) {
                    $el.css('position', 'static');
                    $el.css('top', 0);
                    $heightPlaceholderEl.remove();
                    // NOTE - Yes, this is exactly a one time solution that we'll fix later
                    $el.css('width', 'initial');
                    currentlyFixed = false;
                }
            }
        });
    }
}