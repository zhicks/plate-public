import { Component } from '@angular/core';
import {PlateSideBarService} from "../+home/sidebar/sidebar.component";

@Component({
    moduleId: module.id,
    selector: 'plate-main-settings',
    templateUrl: '/ps/app/+settings/settings-master.component.html'
})
export class SettingsMasterComponent {
    constructor(
        private plateSideBarService: PlateSideBarService
    ) { }

    ngOnInit() {
        this.plateSideBarService.inactive = true;
    }
}
