// https://gist.github.com/ihadeed/5f73e703897318e86521d5e5008347d8

declare const moment;
declare const $: any;

import {
    Component, ElementRef, Output, EventEmitter, Input, Injectable, ViewChild
} from "@angular/core";

export interface PlateCalendarOptions {
    beforeAfter?: boolean
    removable?: boolean
}

@Injectable()
export class DatePickerService {
    listener: (date: Date) => void;
    component: SemanticCalendarComponent;
    calendarSettings: CalendarOptions = {
        inline: true
    }
    listen(callback: (date: Date) => void) {
        this.listener = callback;
    }
    show(beneathElement: HTMLElement, time: number) {
        this.component.show(beneathElement, time);
    }
    hide() {
        this.component.hide();
    }
    toggle(beneathElement: HTMLElement, time: number, options?: PlateCalendarOptions) {
        this.component.toggle(beneathElement, time, options);
    }

    // Specifically for the directive
    private onDateChange(date: Date): void {
        if (this.listener) {
            this.listener(date);
        }
    }
    _registerDirective(component: SemanticCalendarComponent) {
        this.component = component;
    }
}

export interface CalendarChangeEmitObject {
    date: Date,
    rangeSelection: string
}

@Component({
    selector: 'calendar',
    template: `
        <div ui-calendar class="ui calendar">
            <div #aboveCalendarWrapper style="width: calc(100% - 1px);">
                <div class="range-selector calendar-top" *ngIf="plateCalendarOptions.beforeAfter">
                    <div class="ui form">
                      <div class="range-fields">
                        <div class="radio-wrapper" (click)="radioClicked('Before')">
                          <div class="ui radio checkbox">
                            <input id="datepicker-before-radio" type="radio" name="rangeSelection" value="Before">
                            <label>Before</label>
                          </div>
                        </div>
                        <div class="radio-wrapper" (click)="radioClicked('On')">
                          <div class="ui radio checkbox">
                            <input id="datepicker-on-radio" type="radio" name="rangeSelection" value="On" checked="checked">
                            <label>On</label>
                          </div>
                        </div>
                        <div class="radio-wrapper" (click)="radioClicked('After')">
                          <div class="ui radio checkbox">
                            <input id="datepicker-after-radio" type="radio" name="rangeSelection" value="After">
                            <label>After</label>
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
                <div class="above-calendar" [ngClass]="plateCalendarOptions.beforeAfter ? '' : 'calendar-top'">
                    <div style="padding-right: 0.3rem">
                      <div class="above-calendar-header">DATE</div>
                      <div><input type="text" class="ui-plate plain-input small" placeholder="Pick a date"></div>
                    </div>
                    <div>
                      <div class="above-calendar-header">TIME</div>
                      <div><input type="text" class="ui-plate plain-input small" placeholder="Optional time" [(ngModel)]="time" (blur)="timeInputBlurred()"></div>
                    </div>
                  </div>
            </div>
            <div class="below-calendar" style="width: calc(100% - 1px);" [ngClass]="plateCalendarOptions.removable ? 'flex space-between' : 'flex right'">
                <button class="ui button red tiny" [hidden]="!plateCalendarOptions.removable" (click)="removeClicked()">Remove</button>
                <div><button class="ui button primary tiny" (click)="okClicked()">OK</button>
                <button class="ui button tiny" (click)="nevermindClicked()">Nevermind</button></div>
            </div>
        </div>
`,
    styles: [
        `.ui.calendar {
            position: absolute;
            top: 0;
            left: 0;
            display: none;
            z-index: 10000;
        }
        .above-calendar {
            display: flex;
            background: white;
            padding: 0.5rem;
            border-left: 1px solid #CCC;
            border-right: 1px solid #CCC;
        }
        .above-calendar-header {
            font-size: 0.8rem;
            color: #666;
        }
        .below-calendar {
            background: white;
            border-bottom-left-radius: 0.3rem;
            border-bottom-right-radius: 0.3rem;
            padding: 0.5rem;
            border-left: 1px solid #CCC;
            border-right: 1px solid #CCC;
            border-bottom: 1px solid #CCC;
        }
        .range-selector {
            background: white;
            border-left: 1px solid #CCC;
            border-right: 1px solid #CCC
        }
        .range-fields {
            display: flex;
            justify-content: space-around;
            padding: 0.5rem;
        }
        .calendar-top {
            border-top-left-radius: 0.3rem;
            border-top-right-radius: 0.3rem;
            border-top: 1px solid #CCC;
        }
        .radio-wrapper {
            cursor: pointer !important;
        }
        .radio-wrapper label {
            cursor: pointer !important;
        }
        `
    ]
})
export class SemanticCalendarComponent {
    @ViewChild('aboveCalendarWrapper')
    aboveCalendarWrapper: ElementRef;

    @Output() onDateChange: EventEmitter<CalendarChangeEmitObject> = new EventEmitter<CalendarChangeEmitObject>();
    @Input() settings: CalendarOptions = {};
    private selectedDate: Date;
    time = '';
    plateCalendarOptions: PlateCalendarOptions = {};
    rangeSelection = 'On';
    constructor(
        private parentElement: ElementRef,
        private datePickerService: DatePickerService
    ){
        this.datePickerService._registerDirective(this);
    }
    radioClicked(rangeSelection: string) {
        let selector = '';
        switch (rangeSelection) {
            case 'Before':
                selector = '#datepicker-before-radio';
                break;
            case 'On':
                selector = '#datepicker-on-radio';
                break;
            case 'After':
                selector = '#datepicker-after-radio';
                break;
        }
        if (this.aboveCalendarWrapper) {
            let $wrapper = $(this.aboveCalendarWrapper.nativeElement);
            $wrapper.find(selector).prop('checked', true);
        }
        this.rangeSelection = rangeSelection;
    }
    ngAfterViewInit(): void {
        setTimeout(() => {
            let calandarWrapperElement: HTMLElement = this.parentElement.nativeElement;
            $(calandarWrapperElement).appendTo('body'); // Move to body
        }, 1000);
        this.settings.type = 'date';
        this.settings.onChange = (date: Date) => {
            console.log('settings on change');
            this.writeValue(date);
            return true;
        };
        let calandarElement: HTMLElement = this.parentElement.nativeElement.children[0];
        $(calandarElement).calendar(this.settings);
    }
    private reinitCalendar(initialDate: Date) {
        if (initialDate) {
            let momentDate = moment(initialDate);
            if (momentDate.hours() === 0 && momentDate.minutes() === 0) {
                this.time = '';
            } else {
                if (momentDate.isValid()) {
                    this.time = moment(initialDate).format('hh:mm A');
                } else {
                    this.time = '';
                }
            }
        }
        let calandarElement: HTMLElement = this.parentElement.nativeElement.children[0];
        $(calandarElement).calendar('set date', initialDate);
    }
    writeValue (value: Date): void {
        console.log('write value');
        if (value === this.selectedDate) {
            return;
        }
        //this.self.viewToModelUpdate(value);
        this.selectedDate = value;
    }

    removeClicked() {
        this.onDateChange.emit(null);
        this.hide();
    }
    okClicked() {
        let hours = 0;
        let minutes = 0;
        if (this.time) {
            let timeTokens = this.time.split(':');
            if (timeTokens && timeTokens.length === 2 || timeTokens.length === 3) {
                let hourString = timeTokens[0];
                let minuteAndAmPmString = timeTokens[1];
                let minuteAndAmPmStringTokens = minuteAndAmPmString.split(' ');
                if (minuteAndAmPmStringTokens && minuteAndAmPmStringTokens.length === 2) {
                    let amPmString = minuteAndAmPmStringTokens[1];
                    if (amPmString === 'AM' || amPmString === 'PM') {
                        hours = +hourString;
                        minutes = +minuteAndAmPmStringTokens[0];
                        if (amPmString === 'PM' && hours !== 12) {
                            hours += 12;
                        }
                    }
                }
            }
        }
        let date = moment(this.selectedDate).hour(hours).minute(minutes).toDate();
        this.onDateChange.emit({date: date, rangeSelection: this.rangeSelection});
        this.hide();
    }
    nevermindClicked() {
        this.hide();
    }

    timeInputBlurred() {
        let momentTime = moment(this.time, ['h:m a', 'H:m']);
        if (momentTime && momentTime.isValid && momentTime.isValid()) {
            this.time = momentTime.format('hh:mm A');
        } else {
            this.time = '';
        }
        //moment('14:36 am', ['h:m a', 'H:m']).format('hh:mm A')
    }

    private hideReference = function(event) {
        console.log('hide reference');
        if(!$(event.target).closest('[ui-calendar]').length) {
            this.hide();
            console.log('hide reference 2');
        }
    }
    show(beneathElement: HTMLElement, time: number, options?: PlateCalendarOptions) {
        if (options) {
            this.plateCalendarOptions = options;
        } else {
            this.plateCalendarOptions = {};
        }
        this.reinitCalendar(time ? new Date(time) : null);
        let $calendarElement: any = $(this.parentElement.nativeElement.children[0]);
        let $beneathElement = $(beneathElement);
        let offset = $beneathElement.offset();
        let calendarHeight = $calendarElement.outerHeight();
        let calendarWidth = $calendarElement.outerWidth();
        let windowHeight = $(window).height();
        let windowWidth = $(window).width();
        let newTop = offset.top + $beneathElement.outerHeight();
        let newLeft = offset.left;
        if (newTop + calendarHeight > windowHeight) {
            // It's going past the window bottom
            let diff = newTop + calendarHeight - windowHeight;
            newTop -= diff;
        }
        if (newLeft + calendarWidth > windowWidth) {
            // It's going past the window right side
            let diff = newLeft + calendarWidth - windowWidth;
            newLeft -= diff;
        }
        $calendarElement.css({
            top: newTop,
            left: newLeft
        });
        if (!$calendarElement.transition('is visible')) {
            $calendarElement.transition({
                animation: 'slide down',
                onComplete : () => {
                    $(document).on('click.semanticUiCalendar', this.hideReference.bind(this));
                }
            });
        }
    }
    hide() {
        let $calendarElement: any = $(this.parentElement.nativeElement.children[0]);
        if ($calendarElement.transition('is visible')) {
            $calendarElement.transition('slide down');
        }
        $(document).off('click.semanticUiCalendar');
    }
    toggle(beneathElement: HTMLElement, time: number, options?: PlateCalendarOptions) {
        let $calendarElement: any = $(this.parentElement.nativeElement.children[0]);
        if ($calendarElement.transition('is visible')) {
            this.hide();
        } else {
            this.show(beneathElement, time, options);
        }
    }
}
export interface CalendarOptions {
    type?: string;
    startCalendar?: HTMLElement;
    endCalendar?: HTMLElement;
    closable?: boolean;
    startMode?: string;
    ampm?: boolean;
    on?: string;
    minDate?: Date;
    maxDate?: Date;
    formatter?: Function;
    monthFirst?: boolean;
    inline?: boolean;
    onChange?: Function;
    initialDate?: Date;
}