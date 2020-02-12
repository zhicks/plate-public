import {Injectable, ElementRef} from "@angular/core";
import {ClientUtil} from "../../../../shared/scripts/util.service";

@Injectable()
export class PlatePowerSearchService {

    searchText = '';

    constructor(

    ){

    }

    init(el: ElementRef) {
        $(el.nativeElement).appendTo('body');
        this.initListener();
    }

    private initListener() {
        if ($) {
            $('body').on('mouseup.powerSearch', () => {
                setTimeout(() => {
                    let text = '';
                    let doc: any = document;
                    if (window.getSelection) {
                        text = window.getSelection().toString();
                    } else if (doc.selection && doc.selection.createRange) {
                        text = doc.createRange().text;
                    }
                    if (text && text.length > 3 && text.length < 20) {
                        this.searchText = text;
                    } else {
                        this.searchText = '';
                    }
                }, 100);
            })
        }
    }
}