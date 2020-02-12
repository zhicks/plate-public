import {Component, OnInit, Input, ViewChild, ElementRef} from "@angular/core";
import {
    ClientGmailMessage,
    MessageUIExpansion,
    PlateIntegrationGmailUtility
} from "../../../shared/integrations/gmail/plate-integration-gmail.service";
import {ClientUtil} from "../../../../../shared/scripts/util.service";
import {PlateSanitizeService} from "../../../shared/utils/plate-sanitize.service";
import {GmailPlateComponent} from "../gmail-plate.component";

@Component({
    moduleId: module.id,
    selector: 'plate-gmail-message-expanse',
    templateUrl: `/ps/app/+plates/gmail/+message/gmail-plate-message-expanse.component.html`
})
export class GmailPlateMessageExpanseComponent implements OnInit {

    @Input('gmailPlateComponent')
    gmailPlateComponent: GmailPlateComponent;

    @Input('message')
    message: ClientGmailMessage;

    @Input('originalContentWrapper')
    originalContentWrapper: any; // The gmail item that wraps around this - optional if this is standalone

    @Input('gmailPlateContentWrapper')
    gmailPlateContentWrapper: any; // The gmail plate to reference the top of when scrolling - later this can be agnostic - any element that wraps

    @ViewChild('expanseContentWrapper')
    expanseContentWrapper: ElementRef;

    @ViewChild('messageBody')
    messageBody: ElementRef;

    // @ViewChild('messageBodyIframe')
    // messageBodyIframe: ElementRef;

    emailBody: any;
    replyBoxOpen = false;
    editSubject = false;
    reply = {
        subject: '',
        content: ''
    }

    private Constants = {
        Keys: {

        }
    }

    constructor(
        private util: ClientUtil,
        private plateSanitizeService: PlateSanitizeService
    ) { }

    ngOnInit() {
        this.emailBody = this.plateSanitizeService.sanitize(PlateIntegrationGmailUtility.getBody(this.message.model));
        $(this.messageBody.nativeElement).html(this.emailBody);

        this.reply = {
            subject: `${this.message.subject}`,
            content: ''
        }

        // const nativeElement = this.messageBodyIframe.nativeElement;
        // const body = nativeElement.contentWindow.document.body;
        // body.innerHTML = this.emailBody;
        // $(nativeElement).height($(body).height() + 'px');
    }

    ngAfterViewInit() {
        if (this.originalContentWrapper) {
            $(this.originalContentWrapper).css('display', 'none');
            $(this.originalContentWrapper).css('opacity', 0);
        }
        (<any>$(this.expanseContentWrapper.nativeElement)).transition({
            animation: 'scale'
        });
        setTimeout(() => {
            const $expanse = (<any>$(this.expanseContentWrapper.nativeElement));
            const $contentWrapper = $(this.gmailPlateContentWrapper);
            const $subcontentWrapper = $contentWrapper.children().first();
            const padding = 40;
            const contentWrapperTop = $subcontentWrapper.offset().top; // This will be a value like -1400
            const expanseTop = $expanse.offset().top; // This will be a value like -540; always more than contentWrapperTop
            const val = expanseTop - contentWrapperTop; // The difference between them will be positive
            $contentWrapper.animate({scrollTop: val - padding}, 100);
        }, 200);
    }

    ngOnDestroy() {
        (<any>$(this.expanseContentWrapper.nativeElement)).remove();
        if (this.originalContentWrapper) {
            $(this.originalContentWrapper).css('display', 'block');
            setTimeout(() => {
                $(this.originalContentWrapper).css('opacity', 1);
            }, 1)
        }
    }

    // ------------------------------------------------------------------- Events from UI

    headerClicked() {
        // (<any>$(this.expanseContentWrapper.nativeElement)).transition({
        //     animation: 'slide down',
        //     // duration: '160ms',
        //     onComplete: () => {
        //         this.message.expanded = MessageUIExpansion.NotExpanded;
        //         $(this.originalContentWrapper).show();
        //     }
        // });
        this.message.expanded = MessageUIExpansion.NotExpanded;
    }

    sendReplyClicked() {
        this.gmailPlateComponent.sendReply(this.message, this.reply.subject, this.reply.content);
        this.clearReply();
    }

    private clearReply() {
        this.reply = {
            subject: `${this.message.subject}`,
            content: ''
        }
        this.editSubject = false;
        this.replyBoxOpen = false;
    }
    deleteReplyClicked() {
        this.clearReply();
    }

    // ------------------------------------------------------------------- UI State

    onTextAreaHeightChanged(height: number) {
        // Do nothing - yet
    }

}
