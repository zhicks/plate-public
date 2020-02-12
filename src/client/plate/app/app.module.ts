import {NgModule} from "@angular/core";
import {BrowserModule} from "@angular/platform-browser";
import {AppComponent} from "./app.component";
import {AUTH_PROVIDERS} from "angular2-jwt/angular2-jwt";
import {PlateAuthService} from "../../shared/scripts/auth.service";
import {PLATE_ROUTES} from "./app.routes";
import {PlateHorizontalScrollDirective} from "../../shared/scripts/directives/plate-horizontal-scroll.directive";
import {PlateComponent} from "./+plates/native/plate.component";
import {GmailPlateComponent} from "./+plates/gmail/gmail-plate.component";
import {SlackPlateComponent} from "./+plates/slack/slack-plate.component";
import {PlateItemEditComponent} from "./+plates/native/item-edit/plate-item-edit.component";
import {Dragula} from "ng2-dragula/ng2-dragula";
import {SemanticDropdownDirective} from "../../shared/scripts/directives/semantic-dropdown.directive";
import {MomentPipe} from "../../shared/scripts/directives/moment.pipe";
import {PlateSideBarDirective} from "./+home/sidebar/sidebar.directive";
import {SemanticPopupDirective} from "../../shared/scripts/directives/semantic-popup.directive";
import {zIconDirective} from "../../shared/scripts/directives/z-icon.directive";
import {PlateStickIfScrollPastDirective} from "../../shared/scripts/directives/plate-stick-if-scroll-past.directive";
import {GmailPlateMessageExpanseComponent} from "./+plates/gmail/+message/gmail-plate-message-expanse.component";
import {ListenForNewDirective} from "../../shared/scripts/directives/listen-for-new.directive";
import {OrderByPipe} from "../../shared/scripts/directives/order-by.pipe";
import {TextAreaAutoGrowDirective} from "./shared/utils/text-area-auto-grow.directive";
import {FocusOnDirective} from "./shared/utils/focus-on.directive";
import {BodyDropdownDirective} from "./shared/utils/bodyDropdown.directive";
import {RoleForTeamPipe, SettingsTeamViewComponent} from "./+settings/team/settings-team-view.component";
import {PlateRightBarComponent} from "./+rightbar/plate-right-bar.component";
import {PlateSideBarComponent} from "./+home/sidebar/sidebar.component";
import {SemanticCalendarComponent} from "./shared/utils/semanticCalendar.component";
import {PlateSemanticToastComponent} from "../../shared/scripts/directives/plate-toast.component.service";
import {PlateTopBarComponent} from "./shared/topbar/plate-top-bar.component";
import {SemanticRatingDirective} from "../../shared/scripts/directives/semantic-rating.directive";
import {HttpModule} from "@angular/http";
import {FormsModule} from "@angular/forms";
import {SettingsMasterComponent} from "./+settings/settings-master.component";
import {SettingsGoldComponent} from "./+settings/gold/settings-gold.component";
import {SettingsProfileComponent} from "./+settings/profile/settings-profile.component";
import {HomeComponent} from "./+home/home.component";
import {FileUploadModule} from "ng2-file-upload/ng2-file-upload";
import {SettingsBusinessComponent} from "./+settings/business/settings-business.component";
import {FadeInDirective} from "./shared/utils/fade-in.directive";
import {DynamicPlateComponent} from "./+plates/dynamic/dynamic-plate.component";
import {SemanticAccordionDirective} from "../../shared/scripts/directives/semantic-accordion.directive";

const PROVIDERS = [
    AUTH_PROVIDERS,
    PlateAuthService
]

const DECLARATIONS = [
    AppComponent,
    PlateHorizontalScrollDirective,
    PlateComponent,
    GmailPlateComponent,
    SlackPlateComponent,
    DynamicPlateComponent,
    PlateItemEditComponent,
    Dragula,
    SemanticDropdownDirective,
    MomentPipe,
    zIconDirective,
    SemanticPopupDirective,
    PlateSideBarDirective,
    PlateStickIfScrollPastDirective,
    GmailPlateMessageExpanseComponent,
    ListenForNewDirective,
    OrderByPipe,
    TextAreaAutoGrowDirective,
    FocusOnDirective,
    FadeInDirective,
    BodyDropdownDirective,
    RoleForTeamPipe,
    PlateTopBarComponent,
    PlateSemanticToastComponent,
    SemanticCalendarComponent,
    PlateSideBarComponent,
    PlateRightBarComponent,
    SemanticRatingDirective,
    SettingsMasterComponent,
    SettingsTeamViewComponent,
    SettingsGoldComponent,
    SettingsBusinessComponent,
    SettingsProfileComponent,
    HomeComponent,
    SemanticAccordionDirective
]

@NgModule({
    declarations: DECLARATIONS,
    imports:      [BrowserModule, HttpModule, PLATE_ROUTES, FormsModule, FileUploadModule],
    bootstrap:    [AppComponent],
    providers: PROVIDERS
})
export class AppModule { }