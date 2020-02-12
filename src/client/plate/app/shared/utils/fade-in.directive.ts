import {Directive, ElementRef, Input, EventEmitter} from '@angular/core';
import { Subscription } from 'rxjs/Subscription';

@Directive({ selector: '[fadeIn]' })
export class FadeInDirective {

    private fadeInEmitterSubscription: Subscription;

    constructor(
        private el: ElementRef
    ) {}

    @Input('fadeIn')
    set fadeIn(fadeEmitter: any) {
        $(this.el.nativeElement).css({
            opacity: 0,
            transition: 'opacity 600ms'
        });
        // Note this is really only one case.
        // Right now just used in plateTopBarComponent
        if (typeof fadeEmitter === 'string') {
            if (fadeEmitter === 'full') {
                setTimeout(() => {
                    $(this.el.nativeElement).css('opacity', 1);
                }, 600);
            }
        } else {
            let focusEmitterEvent: EventEmitter<any> = fadeEmitter;
            if(this.fadeInEmitterSubscription) {
                this.fadeInEmitterSubscription.unsubscribe();
            }
            this.fadeInEmitterSubscription = focusEmitterEvent.subscribe((
                ()=> this.el.nativeElement.focus()).bind(this)
            )
        }
    };

}
