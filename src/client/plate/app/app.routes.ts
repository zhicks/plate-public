import { Routes, RouterModule } from '@angular/router';

import { SettingsMasterComponent } from './+settings/settings-master.component';
import { SettingsProfileComponent } from './+settings/profile/settings-profile.component';
import { SettingsTeamViewComponent } from './+settings/team/settings-team-view.component';
import { HomeComponent } from './+home/home.component';
import {PlateItemEditComponent} from "./+plates/native/item-edit/plate-item-edit.component";
import {SettingsBusinessComponent} from "./+settings/business/settings-business.component";

export const routes: Routes = [
    { path: 'settings', component: SettingsMasterComponent, children: [
        { path: 'team', component: SettingsTeamViewComponent },
        { path: 'business', component: SettingsBusinessComponent },
        { path: 'profile', component: SettingsProfileComponent },
        { path: '', redirectTo: 'profile' }
    ]},
    { path: '', component: HomeComponent, children: [
        { path: 'item/:id', component: PlateItemEditComponent },
        { path: '', pathMatch: 'full' }
    ] }
];

export const PLATE_ROUTES = RouterModule.forRoot(routes);