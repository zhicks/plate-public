declare const moment;
import {Pipe, PipeTransform} from '@angular/core';

// IF THIS CHANGES - Change it in Slack service - the URL issues screw this up
function getDateForSlackWeirdTimestamp(messageTsString: string) {
    let stringValue = messageTsString;
    stringValue = stringValue.replace('.', '');
    return new Date(+stringValue.substring(0, stringValue.length - 3));
}

/*
 * Time helper using momentjs
 * Usage:
 *   timestamp | moment:'DD.MM.YYYY'
 * Defaults to 'L' - locale ie. '01/24/2016'
 */
@Pipe({name: 'moment'})
export class MomentPipe implements PipeTransform {

    static staticTransform(value:any, arg:string) : any {
        let showExactTime = false;
        let showFullTime = false;
        if (arg === 'time') {
            showExactTime = true;
        } else if (arg === 'slack') {
            value = getDateForSlackWeirdTimestamp(value).getTime();
            showExactTime = true;
        } else if (arg === 'full') {
            showFullTime = true;
        }
        let dateTimeOptions;
        if (showFullTime) {
            let fullTimeFormat = 'MMMM Do YYYY';
            dateTimeOptions = {
                sameDay: fullTimeFormat,
                nextDay: fullTimeFormat,
                nextWeek: fullTimeFormat,
                lastDay: fullTimeFormat,
                lastWeek: fullTimeFormat,
                sameElse: fullTimeFormat
            }
        } else if (!showExactTime) {
            dateTimeOptions = {
                sameDay: 'h:mm A',
                nextDay: '[Tomorrow] h:mm A',
                nextWeek: 'MMM D h:mm A',
                lastDay: '[Yesterday]',
                lastWeek: 'MMM D',
                sameElse: 'MMM D'
            }
        } else {
            let momentDate = moment(value);
            if (momentDate.hours() === 0 && momentDate.minutes() === 0) {
                dateTimeOptions = {
                    sameDay: '[Today]',
                    nextDay: '[Tomorrow]',
                    nextWeek: 'MMM D',
                    lastDay: '[Yesterday]',
                    lastWeek: 'MMM D',
                    sameElse: 'MMM D'
                }
            } else {
                dateTimeOptions = {
                    sameDay: 'h:mm A',
                    nextDay: '[Tomorrow] h:mm A',
                    nextWeek: 'MMM D h:mm A',
                    lastDay: '[Yesterday] h:mm A',
                    lastWeek: 'MMM D h:mm A',
                    sameElse: 'MMM D h:mm A'
                }
            }
        }
        let date = moment(value);
        if (date.isValid()) {
            return date.calendar(null, dateTimeOptions);
        } else {
            return value;
        }
    }

    transform(value:any, arg:string) : any {
        return MomentPipe.staticTransform(value, arg);
    }
}