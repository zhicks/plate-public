import {Directive, ElementRef, Input, EventEmitter} from "@angular/core";
import {Subscription} from "rxjs/Subscription";

@Directive({ selector: '[focusOn]' })
export class FocusOnDirective {

    private focusEmitterSubscription: Subscription;

    constructor(
        private el: ElementRef
    ) {}

    @Input('focusOn')
    set focusOn(focusEmitter: any) {
        if (typeof focusEmitter === 'string') {
            if (focusEmitter === 'full') {
                this.el.nativeElement.setSelectionRange(0, this.el.nativeElement.value.length);
                this.el.nativeElement.focus();
            }
        } else {
            let focusEmitterEvent: EventEmitter<any> = focusEmitter;
            if(this.focusEmitterSubscription) {
                this.focusEmitterSubscription.unsubscribe();
            }
            this.focusEmitterSubscription = focusEmitterEvent.subscribe((
                ()=> this.el.nativeElement.focus()).bind(this)
            )
        }

    };

}
