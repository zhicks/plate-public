import {Component, Injectable} from "@angular/core";
import {ActivityService, UIClientActivity, ClientActivityActionType} from "../shared/api/activity.service";
import {UsersService} from "../shared/api/users.service";
import {EditingPlateItemService} from "../+plates/native/item-edit/editing-plate-item.service";
import {PlatesService} from "../shared/api/plates.service";
import {PlateErrorHandlerService} from "../shared/utils/plate-error-handler.service";
import {HomePlateService} from "../+home/homeplate.service";
import {Router} from "@angular/router";

@Injectable()
export class PlateRightBarService {
    visible = true;
}

@Component({
    moduleId: module.id,
    selector: 'plate-right-bar',
    templateUrl: `/ps/app/+rightbar/plate-right-bar.component.html`
})
export class PlateRightBarComponent {

    private activities: UIClientActivity[] = [];

    constructor(
        private plateRightBarService: PlateRightBarService,
        private activityService: ActivityService,
        private usersService: UsersService,
        private editingPlateItemService: EditingPlateItemService,
        private platesService: PlatesService,
        private plateErrorHandler: PlateErrorHandlerService,
        private homePlateService: HomePlateService,
        private router: Router
    ) {}

    ngOnInit() {
        this.activities = this.activityService.cache;
    }

    // ------------------------------------------------------------------- UI Events

    activityClicked(activity: UIClientActivity) {
        switch (activity.model.activityActionType) {
            case ClientActivityActionType.CreatePlateItem:
            case ClientActivityActionType.ChangePlateItemMetric:
            case ClientActivityActionType.MarkAsDonePlateItem:
            case ClientActivityActionType.EditPlateItemTitle:
            case ClientActivityActionType.MovePlateItem:
            case ClientActivityActionType.AttachGmail:
            case ClientActivityActionType.AttachSlack:
            case ClientActivityActionType.CreateDueDate:
            case ClientActivityActionType.ChangeDueDate:
            case ClientActivityActionType.RemoveDueDate:
            case ClientActivityActionType.CreateComment:
            case ClientActivityActionType.EditComment:
                if (activity.model.item) {
                    this.editingPlateItemService.setItemById(activity.model.item, 'Edit item');
                    this.activityService.emitActivityClickedForPlateItem(activity);
                }
                break;
            case ClientActivityActionType.ChangePlateHeader:
            case ClientActivityActionType.NewHeader:
            case ClientActivityActionType.RemoveHeader:
                if (activity.model.item) {
                    this.homePlateService.openPlateById(activity.model.item);
                }
                break;
            case ClientActivityActionType.CreatePlatter:
                break;
            case ClientActivityActionType.InviteTeamMember:
                this.router.navigate(['/settings/team']);
                break;
        }
        if (!activity.userAcked) {
            this.activityService.acknowledge(activity);
        }
    }

    closeButtonClicked() {
        this.plateRightBarService.visible = false;
    }
}
