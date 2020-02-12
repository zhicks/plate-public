import {Directive, AfterViewInit, ElementRef} from '@angular/core';

@Directive({ selector: '[plateSideBar]' })
export class PlateSideBarDirective implements AfterViewInit {

    constructor(
        private el: ElementRef
    ) {}

    ngAfterViewInit() {

        const $sidebar = $('[platesidebar]');
        const SIDE_BAR_BUTTON_SELECTOR_TOP_BAR = '[plate-sidebar-menu-button]';
        const SIDE_BAR_CLOSE_BUTTON_SELECTOR = '[close-sidebar-button]';
        const $sideBarButtonOnTopBar = $(SIDE_BAR_BUTTON_SELECTOR_TOP_BAR);
        const MAIN_PUSHER_SELECTOR = 'body > .pusher';

        // const PUSHABLE_SELECTOR = '[plate-pushable]';
        // const $pushable = $(PUSHABLE_SELECTOR);
        // const SIDE_BAR_BUTTON_INACTIVE_CLASS = 'inactive';

        const $el: any = $(this.el.nativeElement);

        $el.sidebar({
            //context: $pushable,
            dimPage          : false,
            transition       : 'uncover',
            mobileTransition : 'overlay',
            silent: true,
            closable: false, // so clicking on page doesn't auto minimize
            onVisible: () => {
                $sideBarButtonOnTopBar.hide();
                $(MAIN_PUSHER_SELECTOR).width($('body').width() - $sidebar.outerWidth());
            },
            onHide: () => {
                $sideBarButtonOnTopBar.show();
                $(MAIN_PUSHER_SELECTOR).width('100%');
            }
        })
            .sidebar('attach events', SIDE_BAR_BUTTON_SELECTOR_TOP_BAR, 'show')
            .sidebar('attach events', SIDE_BAR_CLOSE_BUTTON_SELECTOR, 'hide');

    }

}
