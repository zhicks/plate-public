import {Component} from "@angular/core";
import {Analytics} from "../../../../shared/scripts/analytics.service";

@Component({
    moduleId: module.id,
    templateUrl: '/ps/app/+settings/gold/settings-gold.component.html'
})
export class SettingsGoldComponent {

    constructor(

    ) {}

    ngOnInit() {
        Analytics.default('Settings Gold Page Viewed', 'ngOnInit()');
    }

    sendFeedbackClicked() {
        // Temporary
        $('[feedback-button]').click();
    }

}
