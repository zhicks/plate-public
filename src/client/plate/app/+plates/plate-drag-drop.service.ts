import {Injectable} from "@angular/core";
import {DragulaService} from "ng2-dragula/ng2-dragula";
import {BasePlateComponentBase} from "./baseplate.component";
import {UIClientPlateItem} from "../shared/api/plateitems.service";
import {ClientGmailMessage} from "../shared/integrations/gmail/plate-integration-gmail.service";
import {SearchResult} from "../shared/api/search.service";
import {PlateLocalStorageService} from "../shared/utils/platelocalstorage.service";
import {UIClientSlackPlateMessage} from "../shared/integrations/slack/plate-integration-slack.service";
import {ClientConnectedAppType} from "../shared/api/connectedapp.model";
import {PlateSideBarComponent} from "../+home/sidebar/sidebar.component";
import {ClientUtil} from "../../../shared/scripts/util.service";

export interface BaseDragDrop extends BasePlateComponentBase {

}

export interface NativeDragDropPlate extends BaseDragDrop {
    getItemsForHeader(headerId: string): UIClientPlateItem[];
    itemDroppedFromRemote(fromPlate: NativeDragDropPlate, fromHeaderId: string, targetHeaderId: string, draggingElId: string, newPosition: number);
    itemDroppedFromSame(targetHeaderId: string, fromHeaderId: string, draggingEl: string, newPosition: number);
    itemDraggedOver(bagName: string, draggingEl: HTMLElement, targetBagEl: HTMLElement, fromBagEl: HTMLElement, newEl: HTMLElement);
    itemDraggedOut(bagName: string, draggingEl: HTMLElement, targetBagEl: HTMLElement, fromBagEl: HTMLElement);
    searchResultClicked(result: SearchResult, callback?)
    gmailItemDropped(targetHeaderId: string, position: number, gmailMessage: ClientGmailMessage, itemContent: any, gmailPlate: IDraggableConnectedAppComponent<ClientGmailMessage>, itemToLink: any): void;
    slackItemDropped(targetHeaderId: string, position: number, slackItem: UIClientSlackPlateMessage, itemContent: any, slackPlate: IDraggableConnectedAppComponent<UIClientSlackPlateMessage>, itemToLink: any): void;
    getItemById(id: string): any;
}

/**
 * T being the type of item that belongs to the Plate that would be drug over
 */
export interface IDraggableConnectedAppComponent<T> extends BaseDragDrop {
    getItemById(id: string): T;
    getItemContent(item: T): any;
    refreshOpenTasks();
}

export enum ScrollDirection {
    Vertical,
    Horizontal,
    Both
}

interface EdgeListener {
    $elToScroll: JQuery,
    direction: ScrollDirection,
    idToLookForWhenDragging: string,
    draggingAttrToLookAt: string
}

@Injectable()
export class PlateDragDropService {

    private Constants = {
        plateItemsBagName: 'plate-items-drag',
        platesBagName: 'plates-drag',
        plateSidebarPlatesBagName: 'plate-sidebar-plates-drag'
    }

    private registrations: {
        [id: string]: {
            type: ClientConnectedAppType,
            component: BaseDragDrop
        }
    } = {};
    private sidebarRegistration: PlateSideBarComponent;
    private repeatingCheckForShouldScrollInterval;
    private edgeListeners: EdgeListener[] = [];

    // The el that we're dragging's original - note that it is not copied on drop but is actually transplanted
    // It's the thing that we're dragging that's the actual copy
    private $currentlyDraggingElOriginal: JQuery;
    // This is the copy (or the modified copy, whatever)
    private $currentlyDraggingEl: JQuery;

    // If a base docked plate was dragged from outside that docked base plate, hide it
    private $dockedContainerToHide: JQuery;
    private dockedContainerToHideIsHidden = false;

    private $currentShadowEl: JQuery;
    private $currentShadowElPrev: JQuery;
    private $currentShadowElNext: JQuery;
    private $currentItemToLinkForDragging: JQuery;
    private currentFromRegistration: {
        type: ClientConnectedAppType,
        component: BaseDragDrop
    } = null;

    private lastMove: {
        $el: JQuery,
        $fromBag: JQuery
    } = null;

    private clearDraggingEls() {
        this.$currentlyDraggingElOriginal = null;

        this.$currentlyDraggingEl = null;
        this.$currentShadowEl = null;

        if (this.dockedContainerToHideIsHidden && this.$dockedContainerToHide) {
            this.$dockedContainerToHide.show();
        }
        this.$dockedContainerToHide = null;
        this.dockedContainerToHideIsHidden = false;

        // Keep track of the siblings of the shadow el - these are actually the items that are possible to link, rather than create new
        this.$currentShadowElNext = null;
        this.$currentShadowElPrev = null;

        if (this.$currentItemToLinkForDragging) {
            this.$currentItemToLinkForDragging.removeClass('drop-onto-candidate');
        }
        this.$currentItemToLinkForDragging = null;
        this.currentFromRegistration = null;
    }

    constructor(
        private dragulaService: DragulaService,
        private plateLocalStorageService: PlateLocalStorageService
    ) {
        this.dragulaService.setOptions(this.Constants.plateSidebarPlatesBagName, {
            invalid: function(el, handle) {
                if ($(el).attr('plate-no-drag')) {
                    return true;
                }
                return false;
            },
            accepts: (draggingEl, targetBag, fromBag, itemBeingHoveredOver) => {
                let $fromBag = $(fromBag);
                let $targetBag = $(targetBag);
                let canDrag = $fromBag.attr('canDrag') === 'true';
                if (!canDrag) {
                    return false;
                }
                let canDragOutFromBag = $fromBag.attr('canDragOut') === 'true';
                if (!canDragOutFromBag) {
                    if ($fromBag.attr('platterid') !== $targetBag.attr('platterid')) {
                        return false;
                    }
                }
                let canDragIntoBag = $targetBag.attr('canDragInto') === 'true';
                if (!canDragIntoBag) {
                    return false;
                }
                return true;
            }
        })
        this.dragulaService.setOptions(this.Constants.plateItemsBagName, {
            invalid: function(el, handle) {
                if ($(el).attr('plate-no-drag')) {
                    return true;
                }
                return false;
            },
            accepts: (draggingEl, targetBag, fromBag, itemBeingHoveredOver) => {
                let $fromBag = $(fromBag);
                let $targetBag = $(targetBag);
                    const plateDrag = $targetBag.attr('plate-drag');
                    if (
                        plateDrag === 'gmail' ||
                        plateDrag === 'slack'
                    ) {
                        return false;
                    }

                    let fromPlateId = $fromBag.attr('plateId');
                    let targetPlateId =$targetBag.attr('plateId');
                    if ($fromBag.attr('plate-drag') === 'native') {
                        const canDragOut = $fromBag.attr('can-drag-out');
                        if (!canDragOut) {
                            // If we can't drag out, we need to make sure that the target plate is the same as the current plate
                            if (fromPlateId !== targetPlateId) {
                                return false;
                            }
                        }
                    }
                    // From like connected apps
                    const canAddItems = $targetBag.attr('can-add');
                    if (!canAddItems) {
                        if (fromPlateId !== targetPlateId) {
                            return false;
                        }
                    }
                    return true;
            },
            copy: function(draggingEl, fromBag) {
                const plateDrag = $(fromBag).attr('plate-drag');
                if (
                    plateDrag === 'gmail' ||
                    plateDrag === 'slack'
                ) {
                    return true;
                }
                return false;
            }
        });

        this.dragulaService.drag.subscribe(this.itemDragged.bind(this));
        this.dragulaService.drop.subscribe(this.itemDropped.bind(this));
        this.dragulaService.over.subscribe(this.itemDraggedOver.bind(this));
        this.dragulaService.out.subscribe(this.itemDraggedOut.bind(this));
        this.dragulaService.shadow.subscribe(this.onShadowGeneration.bind(this));
        this.dragulaService.cancel.subscribe(this.onCancel.bind(this));

        $('body').mousemove((event) => {
            if (this.$currentlyDraggingEl) {
                const validDropPixels = 20;
                let shouldHideShadowEl = false;
                if (this.$currentlyDraggingEl && this.$currentlyDraggingEl.length && this.$currentShadowElPrev && this.$currentShadowElPrev.length) {
                    let shadElPrevOffset = this.$currentShadowElPrev.offset();
                    let val = event.pageY - (shadElPrevOffset.top + this.$currentShadowElPrev.outerHeight());
                    val *= -1;
                    //xxxxxxxxx('prev', Date.now(), val);
                    if (val > validDropPixels && event.pageX > shadElPrevOffset.left && event.pageX < shadElPrevOffset.left + this.$currentShadowElPrev.outerWidth()) {
                        shouldHideShadowEl = true;
                        this.$currentShadowElPrev.addClass('drop-onto-candidate');
                        this.$currentItemToLinkForDragging = this.$currentShadowElPrev;
                    } else {
                        this.$currentShadowElPrev.removeClass('drop-onto-candidate');
                    }
                }
                if (this.$currentlyDraggingEl && this.$currentlyDraggingEl.length && this.$currentShadowElNext && this.$currentShadowElNext.length) {
                    let shadElNextOffset = this.$currentShadowElNext.offset();
                    let val = shadElNextOffset.top - (event.pageY);
                    val *= -1;
                    //xxxxxxxxx('next', Date.now(), val);
                    if (val > validDropPixels && event.pageX > shadElNextOffset.left && event.pageX < shadElNextOffset.left + this.$currentShadowElNext.outerWidth()) {
                        shouldHideShadowEl = true;
                        this.$currentShadowElNext.addClass('drop-onto-candidate');
                        this.$currentItemToLinkForDragging = this.$currentShadowElNext;
                    } else {
                        this.$currentShadowElNext.removeClass('drop-onto-candidate');
                    }
                }

                if (this.$currentShadowEl && this.$currentShadowEl.length) {
                    if (shouldHideShadowEl) {
                        // We're hovering over an item and want to link it
                        this.$currentShadowEl.addClass('p-hidden');
                        if (
                            this.currentFromRegistration.type === ClientConnectedAppType.Gmail ||
                            this.currentFromRegistration.type === ClientConnectedAppType.Slack
                        ) {
                            this.$currentlyDraggingEl.find('[new-prompt]').text('Link - ');
                        }
                    } else {
                        // We're not hovering over an item, and want to create a new one
                        this.$currentShadowEl.removeClass('p-hidden');
                        if (
                            this.currentFromRegistration.type === ClientConnectedAppType.Gmail ||
                            this.currentFromRegistration.type === ClientConnectedAppType.Slack
                        ) {
                            this.$currentlyDraggingEl.find('[new-prompt]').text('New Item - ');
                        }
                        this.$currentItemToLinkForDragging = null;
                    }
                }
            }
            if (this.$currentlyDraggingElOriginal) {

                // Hide for docked - dockedContainerToHide will only be present if it was docked
                if (this.$dockedContainerToHide && !this.dockedContainerToHideIsHidden) {
                    let width = this.$dockedContainerToHide.outerWidth();
                    let offset = this.$dockedContainerToHide.offset();
                    let leftDiff = event.pageX - offset.left;
                    let rightDiff = (offset.left + width) - event.pageX;
                    if (leftDiff < 0 || rightDiff < 0) {
                        this.$dockedContainerToHide.hide();
                        this.dockedContainerToHideIsHidden = true;
                    }
                }

                // Scroll listener:
                let listener: EdgeListener = null;
                for (let l of this.edgeListeners) { // TODO -  If this is giving us performance problems, cache it
                    if (l.idToLookForWhenDragging && l.idToLookForWhenDragging === this.$currentlyDraggingElOriginal.attr(l.draggingAttrToLookAt)) {
                        listener = l;
                        break;
                    }
                }
                if (listener) {
                    let $el = listener.$elToScroll;
                    let offset = $el.offset(); // TODO - If this is giving us performance problems, cache it
                    if (listener.direction === ScrollDirection.Vertical) {
                        let height = $el.outerHeight();
                        let heightMinDifferential = Math.max(height/5, 100);
                        let topDiff = event.pageY - offset.top;
                        let bottomDiff = (offset.top + height) - event.pageY;
                        if (topDiff < heightMinDifferential) {
                            let heightMinDiff = heightMinDifferential - topDiff;
                            this.resetCheckForShouldScrollInterval($el, -heightMinDiff, ScrollDirection.Vertical);
                        } else if (bottomDiff < heightMinDifferential) {
                            let heightMinDiff = heightMinDifferential - bottomDiff;
                            this.resetCheckForShouldScrollInterval($el, heightMinDiff, ScrollDirection.Vertical);
                        } else {
                            this.clearIntervalForCheckForShouldScroll();
                        }
                    } else {
                        let width = $el.outerWidth();
                        let widthMinDifferential = Math.max(width/5, 100);
                        let leftDiff = event.pageX - offset.left;
                        let rightDiff = (offset.left + width) - event.pageX;
                        if (leftDiff < widthMinDifferential) {
                            let widthMinDiff = widthMinDifferential - leftDiff;
                            this.resetCheckForShouldScrollInterval($el, -widthMinDiff, ScrollDirection.Horizontal);
                        } else if (rightDiff < widthMinDifferential) {
                            let widthMinDiff = widthMinDifferential - rightDiff;
                            this.resetCheckForShouldScrollInterval($el, widthMinDiff, ScrollDirection.Horizontal);
                        } else {
                            this.clearIntervalForCheckForShouldScroll();
                        }
                    }
                }
            }
        });
    }

    undoMove() {
        if (this.lastMove) {
            let $el = this.lastMove.$el;
            let $fromBag = this.lastMove.$fromBag;
            let chilluns = $fromBag.children();
            if (!chilluns.length) {
                $fromBag.append($el);
            } else {
                let elIndex = +$el.attr('pPos');
                for (let i=0; i < chilluns.length; i++) {
                    let $chillun = $(chilluns[i]);
                    let chillunIndex = +$chillun.attr('pPos');
                    if (ClientUtil.isDefined(chillunIndex)) {
                        if (chillunIndex === elIndex - 1) {
                            $chillun.after($el);
                            break;
                        } else if (chillunIndex === elIndex + 1) {
                            $chillun.before($el);
                            break;
                        }
                    }
                }
            }
        }
        this.lastMove = null;
    }

    private clearIntervalForCheckForShouldScroll() {
        clearInterval(this.repeatingCheckForShouldScrollInterval);
    }
    private resetCheckForShouldScrollInterval($el, diff, direction: ScrollDirection) {
        this.clearIntervalForCheckForShouldScroll();
        this.repeatingCheckForShouldScrollInterval = setInterval(() => {
            if (direction === ScrollDirection.Vertical) {
                $el.scrollTop(
                    $el.scrollTop() + diff/10
                )
            } else if (direction === ScrollDirection.Horizontal) {
                $el.scrollLeft(
                    $el.scrollLeft() + diff/10
                )
            }
        }, 10);
    }
    listenForScrollEdges(someId: string, draggingAttrToLookAt: string, $el: JQuery, direction: ScrollDirection) {
        // TODO - this is goofy as hell - we could get rid of idToLookForWhenDragging
        this.edgeListeners.push({
            $elToScroll: $el,
            direction: direction,
            idToLookForWhenDragging: someId,
            draggingAttrToLookAt: draggingAttrToLookAt
        })
    }

    // The dragula directives in home component render before the constructor
    // of this service, so this has to be called from outside
    setPlateDragDropOptions() {
        this.dragulaService.setOptions('plates-drag', {
            invalid: function(el, handle) {
                if ($(el).attr('plate-no-drag')) {
                    return true;
                }
                return false;
            },
            moves: function(el, container, handle) {
                if ($(handle).attr('p-d-handle')) {
                    return !$(handle).closest('[plate-head-wrapper]').attr('p-d-disable');
                }
            }
        });
    }

    register(type: ClientConnectedAppType, component: BaseDragDrop) {
        this.registrations[component.base.model.id] = {
            type: type,
            component: component
        }
    }

    registerSidebar(sidebar: PlateSideBarComponent) {
        this.sidebarRegistration = sidebar;
    }

    onShadowGeneration(args: any) {
        let [bagName, shadowEl, targetBagEl, fromBagEl] = args;
        // Dragging onto an already existing item -
        // We do it by a combination of here and the mouseevent listener
        // The shadow el may be after an item that we should drag 'into',
        // or it may be before. We check here by:
        //   if the mouse event is within a certain range of either of the shadowEl's siblings
        if (bagName === this.Constants.plateItemsBagName) {
            let fromPlateId = $(fromBagEl).attr('plateId');
            this.currentFromRegistration = this.registrations[fromPlateId];

            // TODO - Later this should be separated for each integration
            if (
                this.currentFromRegistration.type === ClientConnectedAppType.Gmail ||
                this.currentFromRegistration.type === ClientConnectedAppType.Slack
            ) {
                this.$currentShadowEl = $(shadowEl);
                this.$currentShadowElPrev = this.$currentShadowEl.prev();
                this.$currentShadowElNext = this.$currentShadowEl.next();
                this.$currentShadowEl.html('');
                this.$currentShadowEl.removeClass();
                this.$currentShadowEl.addClass('blue-line-shadow-el');
                this.$currentShadowEl.addClass('p-hidden');
            }
        }
    }

    onCancel(args: any) {
        this.clearIntervalForCheckForShouldScroll();

        this.clearDraggingEls();
        let [bagName, draggingEl] = args; // There are other args here
        if (bagName === this.Constants.plateItemsBagName) {

        }
    }

    itemDragged(args: any) {
        let [bagName, draggingEl, fromBagEl] = args;
        this.$currentlyDraggingElOriginal = $(draggingEl);
        if (bagName === this.Constants.plateItemsBagName) {
            let fromPlateId = $(fromBagEl).attr('plateId');
            let fromPlate = this.registrations[fromPlateId];

            let $basePlateMasterWrapper = $(fromBagEl).closest('[base-plate-master-wrapper]');
            let isDocked = $basePlateMasterWrapper.attr('docked');
            if (isDocked) {
                this.$dockedContainerToHide = $basePlateMasterWrapper;
            }

            // TODO - Later this should be separated for each integration
            if (fromPlate.type === ClientConnectedAppType.Gmail) {

                // This will go in gmail component
                const template = `
                    <div class="gmail-dragging-item-content">
                        <div class="left">
                            <img src="/ps/assets/integrations/gmail/logo_gmail_32px.png">
                        </div>
                        <div class="right">
                            <div class="from-wrapper"><span new-prompt class="new-prompt-drag"></span><span from class="from"></span></div>
                            <div subject class="subject"></div>
                        </div>
                    </div>
                `;
                const $template = $(template);

                let fromPlateComponent = <IDraggableConnectedAppComponent<ClientGmailMessage>>fromPlate.component;

                let draggingElId: string = $(draggingEl).attr('id');
                const item = fromPlateComponent.getItemById(draggingElId);
                $template.find('[from]').text(item.from);
                $template.find('[subject]').text(item.subject);
                setTimeout(() => {
                    this.$currentlyDraggingEl = $('#'+draggingElId+'.gu-mirror');
                    this.$currentlyDraggingEl.html(<any>$template);
                    this.$currentlyDraggingEl.addClass('gmail-dragging-item');
                    this.$currentlyDraggingEl.removeClass('listed compact side-margins');
                }, 10);

            } else if (fromPlate.type === ClientConnectedAppType.Slack) {

                let fromPlateComponent = <IDraggableConnectedAppComponent<UIClientSlackPlateMessage>>fromPlate.component;

                let draggingElId: string = $(draggingEl).attr('id');
                setTimeout(() => {
                    this.$currentlyDraggingEl = $('#'+draggingElId+'.gu-mirror');
                    //this.$currentlyDraggingEl.addClass('gmail-dragging-item');
                    this.$currentlyDraggingEl.find('[slack-plate-item-ts]').hide();
                    this.$currentlyDraggingEl.removeClass('listed compact side-margins');
                }, 10);

            } else {
                // Native
            }
        }
    }

    itemDropped(args: any) {
        this.clearIntervalForCheckForShouldScroll();
        // TODO - Later this should be separated for each integration
        let [bagName, draggingEl, targetBagEl, fromBagEl, elAfterDropped] = args;
        if (bagName === this.Constants.plateItemsBagName) {
            let targetPlateId = $(targetBagEl).attr('plateId');
            let fromPlateId = $(fromBagEl).attr('plateId');

            // targetPlateId is null if no appropriate Plate to drop on
            if (targetPlateId) {
                let targetPlate = this.registrations[targetPlateId];
                let fromPlate = this.registrations[fromPlateId];

                if (fromPlate.type === ClientConnectedAppType.Native) {
                    // ------------------------------------------------------------------- Native
                    let targetHeaderId = $(targetBagEl).attr('headerId');
                    let fromHeaderId = $(fromBagEl).attr('headerId');

                    let draggingElId: string = $(draggingEl).attr('id');
                    let $previousEl = $(draggingEl).prev();
                    let pos = 0;
                    if ($previousEl.length && $previousEl.attr('pPos')) {
                        pos = +$previousEl.attr('pPos');
                        if (targetHeaderId !== fromHeaderId) {
                            pos++;
                        } else {
                            let previousPos = +$(draggingEl).attr('pPos');
                            if (pos < previousPos) {
                                pos++;
                            }
                        }
                    }
                    let targetPlateComponent = <NativeDragDropPlate>targetPlate.component;
                    let fromPlateComponent = <NativeDragDropPlate>fromPlate.component;
                    if (fromPlateId === targetPlateId) {
                        targetPlateComponent.itemDroppedFromSame(targetHeaderId, fromHeaderId, draggingElId, pos);
                    } else {
                        targetPlateComponent.itemDroppedFromRemote(fromPlateComponent, fromHeaderId, targetHeaderId, draggingElId, pos);
                    }

                } else if (fromPlate.type === ClientConnectedAppType.Gmail) {
                    // ------------------------------------------------------------------- Gmail
                    let targetHeaderId = $(targetBagEl).attr('headerId');
                    let draggingElId: string = $(draggingEl).attr('id');
                    let $previousEl = $(draggingEl).prev();
                    let pos = 0;
                    if ($previousEl.length) {
                        pos = +$previousEl.attr('pPos') + 1;
                    }

                    let targetPlateComponent = <NativeDragDropPlate>targetPlate.component;
                    let fromPlateComponent = <IDraggableConnectedAppComponent<ClientGmailMessage>>fromPlate.component;

                    const gmailItem = fromPlateComponent.getItemById(draggingElId);
                    let itemToLink = null;
                    if (this.$currentItemToLinkForDragging) {
                        let id = this.$currentItemToLinkForDragging.attr('id');
                        itemToLink = targetPlateComponent.getItemById(id);
                    }
                    targetPlateComponent.gmailItemDropped(targetHeaderId, pos, gmailItem, fromPlateComponent.getItemContent(gmailItem), fromPlateComponent, itemToLink);
                    $(draggingEl).remove();

                } else if (fromPlate.type === ClientConnectedAppType.Slack) {

                    // ------------------------------------------------------------------- Slack
                    let targetHeaderId = $(targetBagEl).attr('headerId');
                    let draggingElId: string = $(draggingEl).attr('id');
                    let $previousEl = $(draggingEl).prev();
                    let pos = 0;
                    if ($previousEl.length) {
                        pos = +$previousEl.attr('pPos') + 1;
                    }

                    let targetPlateComponent = <NativeDragDropPlate>targetPlate.component;
                    let fromPlateComponent = <IDraggableConnectedAppComponent<UIClientSlackPlateMessage>>fromPlate.component;

                    const slackItem = fromPlateComponent.getItemById(draggingElId);
                    let itemToLink = null;
                    if (this.$currentItemToLinkForDragging) {
                        let id = this.$currentItemToLinkForDragging.attr('id');
                        itemToLink = targetPlateComponent.getItemById(id);
                    }
                    targetPlateComponent.slackItemDropped(targetHeaderId, pos, slackItem, fromPlateComponent.getItemContent(slackItem), fromPlateComponent, itemToLink);
                    $(draggingEl).remove();

                }
            }
        } else if (bagName === this.Constants.platesBagName) {
            let id = $(draggingEl).attr('id');
            let type = $(draggingEl).attr('plateType'); // This will be blank for native
            let previousPos = +$(draggingEl).attr('pos');
            let key = this.plateLocalStorageService.Keys.OPEN_BASE_PLATES;
            let pos = 0;
            let $previousEl = $(draggingEl).prev();
            if ($previousEl.length) {
                let index = +$previousEl.attr('pos');
                if (index !== null && index !== undefined) {
                    if (index > previousPos) {
                        // Moved right
                        pos = index;
                    } else {
                        pos = index + 1;
                    }
                }
            }
            this.plateLocalStorageService.removeInArray(key, id);
            this.plateLocalStorageService.insertInArray(key, pos, id);

        } else if (bagName === this.Constants.plateSidebarPlatesBagName) {
            let id = $(draggingEl).attr('listPlateId');
            let platterId = $(targetBagEl).attr('platterId');
            let previousPos: any = $(draggingEl).attr('pPos');
            if (previousPos) {
                previousPos = +previousPos;
            }
            let pos = 0;
            let $previousEl = $(draggingEl).prev();
            if ($previousEl.length) {
                let index = +$previousEl.attr('pPos');
                if (index !== null && index !== undefined) {
                    if ($(fromBagEl).attr('platterid') === $(targetBagEl).attr('platterid')) {
                        if (previousPos < index) {
                            // We moved down
                            pos = index;
                        } else {
                            // We moved up
                            pos = index+1;
                        }
                    } else {
                        pos = index+1;
                    }
                }
            }
            this.lastMove = {
                $el: $(draggingEl),
                $fromBag: $(fromBagEl)
            }
            this.sidebarRegistration.plateDropped(id, platterId, pos, previousPos);
        }

        this.clearDraggingEls();
    }

    itemDraggedOver(args: any) {
        let [bagName, draggingEl, targetBagEl, fromBagEl, newEl] = args;
        if (bagName === this.Constants.plateItemsBagName) {
            let fromPlateId = $(fromBagEl).attr('plateId');
            let fromPlate = this.registrations[fromPlateId];
            let targetBagId = $(targetBagEl).attr('plateId');
            let targetPlate = this.registrations[targetBagId];

            // TODO - Later this should be separated for each integration
            // if (fromPlate.type === UIPlateType.Gmail && targetPlate.type === UIPlateType.Native) {
            //     let draggingElId: string = $(draggingEl).attr('id');
            //     let $dragging = $('#'+draggingElId+'.gu-mirror');
            //     $dragging.find('[new-prompt]').text('New Linked Item - ');
            // }
        }
    }

    itemDraggedOut(args: any) {
        let [bagName, draggingEl, targetBagEl, fromBagEl] = args;
        if (bagName === this.Constants.plateItemsBagName) {
            let fromPlateId = $(fromBagEl).attr('plateId');
            let fromPlate = this.registrations[fromPlateId];

            // TODO - Later this should be separated for each integration
            if (
                fromPlate.type === ClientConnectedAppType.Gmail ||
                fromPlate.type === ClientConnectedAppType.Slack
            ) {
                let draggingElId: string = $(draggingEl).attr('id');
                let $dragging = $('#'+draggingElId+'.gu-mirror');
                $dragging.find('[new-prompt]').text('');
            }
        }
    }


}