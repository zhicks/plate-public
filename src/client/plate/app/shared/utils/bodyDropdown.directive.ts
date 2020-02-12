import {Directive, ElementRef, Injectable} from "@angular/core";

export interface BodyDropdownOptions {
    direction?: 'left' | 'right' | 'up' | 'down'
    relativeEl?: string
    hideOnMenuClick?: boolean
}

const enum MenuState {
    Hidden,
    Opening,
    Open
}

interface SemanticJQuery extends JQuery {
    transition: Function;
}

@Injectable()
export class BodyDropdownService {

    private $currentMenu: SemanticJQuery = null;
    private currentOptions: BodyDropdownOptions = null;
    private $previousMenuLocation: SemanticJQuery = null;
    private previousMenuCss: any = null;
    private menuState: MenuState = MenuState.Hidden;

    constructor() {
        $(document).on('click.bodyDropdownBody', (event) => {
            this.hideCurrentMenu(event);
        });
    }

    private hideCurrentMenu(event) {
        if (this.$currentMenu) {
            if (this.menuState === MenuState.Open) {
                let doHide = false;
                if (!event) {
                    // If there was no click, this is a manual hide
                    doHide = true;
                } else if (this.currentOptions && this.currentOptions.hideOnMenuClick) {
                    // Hide on click
                    doHide = true;
                } else {
                    // If hide on menu click is false, we want to check that the menu
                    // was clicked. If it was, do nothing. If the body was clicked, hide.
                    if ($(event.target).closest('.body-dropdown-menu').length) {
                        // Do nothing
                    } else {
                        doHide = true;
                    }
                }
                if (doHide) {
                    this.$currentMenu.hide();
                    this.$currentMenu.css(this.previousMenuCss);
                    this.$currentMenu.appendTo(this.$previousMenuLocation);
                    this.menuState = MenuState.Hidden;
                }
            } else if (this.menuState === MenuState.Opening) {
                // This will fire directly after opening the menu
                this.menuState = MenuState.Open;
            }
        }
    }

    hide() {
        this.hideCurrentMenu(null);
    }

    clicked($event: MouseEvent, options?: BodyDropdownOptions) {
        options = options || {
                direction: 'down',
                hideOnMenuClick: true
        };
        this.currentOptions = options;
        let $parentEl: SemanticJQuery = <SemanticJQuery>$($event.currentTarget).closest('[bodyDropdown]');;
        let $relativeEl: SemanticJQuery;
        if (options.relativeEl) {
            $relativeEl = <SemanticJQuery>$('body').find(options.relativeEl);
        } else {
            $relativeEl = $parentEl;
        }
        let $menu: SemanticJQuery = <SemanticJQuery>$($event.currentTarget).find('.body-dropdown-menu');
        if ($menu.css('display') === 'none') {
            this.hideCurrentMenu(null);
            this.$currentMenu = $menu;
            this.$previousMenuLocation = $parentEl;
            this.previousMenuCss = {
                top: $menu.css('top'),
                left: $menu.css('left'),
                position: $menu.css('position'),
                zIndex: $menu.css('z-index')
            }
            $menu.show();
            let menuHeight = $menu.outerHeight();
            let menuWidth = $menu.outerWidth();
            let windowHeight = $(window).height();
            let windowWidth = $(window).width();
            $menu.appendTo('body');
            $menu.css('position', 'absolute');
            let relativeElOffset = $relativeEl.offset();
            let newTop = relativeElOffset.top;
            let newLeft = relativeElOffset.left;
            let $caret = $menu.find('.body-dropdown-caret');
            if (options.direction === 'down') {
                newTop += $parentEl.outerHeight();
                newLeft -= menuWidth/2;
            } else if (options.direction === 'left') {
                newTop -= $parentEl.outerHeight();
                newLeft -= menuWidth;
                if ($caret.length) {
                    newLeft -= $caret.outerWidth();
                }
            }
            if (newTop + menuHeight > windowHeight) {
                // It's going past the window bottom
                let diff = newTop + menuHeight - windowHeight;
                newTop -= diff;
            }
            if (newLeft + menuWidth > windowWidth) {
                // It's going past the window right side
                let diff = newLeft + menuWidth - windowWidth;
                newLeft -= diff;
            }
            $menu.css('top', newTop);
            $menu.css('left', newLeft);
            $menu.css('z-index', 10001);
            this.menuState = MenuState.Opening;
            // $menu.hide();
            // $menu.transition('slide down');
            let $firstInput = $menu.find('input').first();
            $firstInput.focus();
        } else if ($menu.css('display') === 'absolute') {

        }
    }
}

@Directive({ selector: '[bodyDropdown]' })
export class BodyDropdownDirective {

    constructor(
        private el: ElementRef
    ) {}

    ngAfterViewInit() {

    }

}
