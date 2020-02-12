import {Component, Injectable, ViewChild, ElementRef} from '@angular/core';

export interface IPlateToast {
    title: string;
    message: string;

    timeout?: number;
    cssClass?: string;
    button?: {
        text: string;
        action: Function
    }

    // Internal
    id?: number;
    closing?: boolean;
    active?: boolean;
}


@Injectable()
export class PlateToastService {

    private defaultTimeout = 3000;
    private newId = 0;
    private closeAnimationTime = 200;

    toasts: IPlateToast[] = [];

    toast(toast: IPlateToast) {
        let timeout = toast.timeout;
        if (!timeout) {
            timeout = this.defaultTimeout;
        }
        this.newId++;
        toast.id = this.newId;
        this.toasts.push(toast);
        setTimeout(() => {
            toast.active = true;
        }, 50);
        setTimeout(() => {
            this.closeToast(toast);
        }, timeout);
        return toast;
    }

    closeToast(toast: IPlateToast) {
        if (toast) {
            toast.closing = true;
            setTimeout(() => {
                for (let i=0; i < this.toasts.length; i++) {
                    if (this.toasts[i].id === toast.id) {
                        this.toasts.splice(i, 1);
                        break;
                    }
                }
            }, this.closeAnimationTime)
        }
    }

}

@Component({
    selector: 'plate-toast',
    template: `
        <div #plateToastsWrapper class="plate-toasts-wrapper" [hidden]="!plateToastService.toasts.length">
            <div *ngFor="let toast of plateToastService.toasts; let i = index;" class="ui message inverted plate-toast" [ngClass]="toast.cssClass" [ngStyle]="getToastStyle(toast)">
                <i class="close icon" (click)="closeToastClicked(toast, i)"></i>
                <div class="header">
                    {{toast.title}}
                </div>
                <p>{{toast.message}}</p>
                <a *ngIf="toast.button" style="cursor: pointer" (click)="buttonClicked(toast, i)">{{toast.button.text}}</a>
            </div>
        </div>
    `,
    styles: [
        `
        .plate-toasts-wrapper {
            display: flex;
            position: fixed;
            bottom: 4%;
            left: 3%;
            z-index: 10009;
        }
        
        .plate-toast {
            margin-right: 1rem;
            opacity: 0;
            transition: all 200ms;
        }
        .plate-toast.small {
            font-size: 0.9rem;
        }
        
        .plate-toast .header {
            text-transform: uppercase;
            padding: 0 2em 0.3rem 0;
            font-size: 1em;
        }
        `
    ]
})
export class PlateSemanticToastComponent {

    @ViewChild('plateToastsWrapper')
    plateToastsWrapper: ElementRef;

    constructor(
        private plateToastService: PlateToastService
    ) {}

    ngAfterViewInit() {
        $(this.plateToastsWrapper.nativeElement).appendTo('body');
    }

    buttonClicked(toast: IPlateToast, index: number) {
        if (toast.button.action) {
            toast.button.action();
        }
        this.plateToastService.closeToast(toast);
    }

    closeToastClicked(toast: IPlateToast, index: number) {
        this.plateToastService.closeToast(toast);
    }

    getToastStyle(toast: IPlateToast): any {
        if (toast.closing) {
            return {
                "opacity": "0",
                "margin-bottom": "-10px"
            };
        }
        else if (toast.active) {
            return {
                "opacity": "1",
                "margin-bottom": "0"
            };
        }

        // Initial state
        return {
            "opacity": "0",
            "margin-bottom": "-10px"
        };
    }

}
