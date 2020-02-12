import {Component, EventEmitter, OnInit, Pipe, PipeTransform} from "@angular/core";
import {Router, ActivatedRoute} from "@angular/router";
import {Subscription} from "rxjs/Subscription";
import {AuthHttp} from "angular2-jwt";
import {PlateAuthService, LoggedInUser} from "../../../../shared/scripts/auth.service";
import {
    TeamsService, UIClientTeam, ClientTeamInvitation, UIClientTeamMember,
    ClientPermissionUserType, ClientPermissionUserTypeStrings, Permissions
} from "../../shared/api/teams.service";
import {PlateErrorHandlerService} from "../../shared/utils/plate-error-handler.service";
import {UsersService} from "../../shared/api/users.service";
import {PlateToastService} from "../../../../shared/scripts/directives/plate-toast.component.service";
import {BuiltInColors} from "../../shared/api/plates.service";
import {Analytics} from "../../../../shared/scripts/analytics.service";
import {HomePlateService} from "../../+home/homeplate.service";

@Pipe({name: 'roleForTeam'})
export class RoleForTeamPipe implements PipeTransform {
    transform(value: string): string {
        switch (value) {
            case 'admin':
                return 'Admin';
            case 'user':
                return 'Normal';
        }
    }
}

@Component({
    moduleId: module.id,
    templateUrl: '/ps/app/+settings/team/settings-team-view.component.html'
})
export class SettingsTeamViewComponent implements OnInit {

    ClientPermissionUserType = ClientPermissionUserType;
    ClientPermissionUserTypeStrings = ClientPermissionUserTypeStrings;
    userInfo: LoggedInUser;
    loading: boolean = true;

    selectedTeam: UIClientTeam = null;
    colors = BuiltInColors;

    teams = [];
    teamInvitations: ClientTeamInvitation[] = []; // Invitations to the user
    newUserEmailText: string;

    newTeamNameText: string;
    editingTeamNameText: string;
    editingTeamName = false;
    editingTeamColor = false;

    routerSubscription: Subscription;
    addTeamMemberFocus: EventEmitter<any> = new EventEmitter();

    permissionSets = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private authHttp: AuthHttp,
        private plateAuthService: PlateAuthService,
        private teamsService: TeamsService,
        private plateErrorHandler: PlateErrorHandlerService,
        private usersService: UsersService,
        private plateToastService: PlateToastService,
        private homePlateService: HomePlateService
    ) { }

    ngOnInit() {
        const userInfo = this.plateAuthService.getUserInfo();
        this.userInfo = userInfo;
        const defaultTeamId = userInfo.defaultTeam;
        const hasTeams = userInfo.teams && userInfo.teams.length > 0;

        if (defaultTeamId) {
            this.teamsService.getById(defaultTeamId).subscribe(
                team => {
                    this.setTeam(team);
                },
                error => this.plateErrorHandler.error(error, 'team service get default team id')
            )
        } else {
            if (hasTeams) {
                this.teamsService.get().subscribe(
                    teams => {
                        if (teams && teams.length) {
                            this.teams = teams;
                            this.setTeam(this.teams[0]);
                        } else {
                            // Looks like we may have been removed from the team
                            // Refresh our credentials
                            this.loading = false;
                            this.plateAuthService.refresh().subscribe((data) => {});
                        }
                    },
                    error => this.plateErrorHandler.error(error, 'team service get')
                )
            } else {
                this.loading = false;
            }
        }

        this.usersService.getTeamInvitations().subscribe((invitations) => {
            this.teamInvitations = invitations;
        },
            error => this.plateErrorHandler.error(error, 'user service get team invites')
        )

        Analytics.default('Team Page Viewed', 'ngOnInit()');
    }

    // ------------------------------------------ UI Events

    changePermissionUserTypeClicked(permission: any, userType: ClientPermissionUserType) {
        this.selectedTeam.model.plateBusiness.permissions[permission.key] = userType;
        permission.userType = userType;
        this.teamsService.savePlateBusinessPermissions(this.selectedTeam).subscribe((status) => {
        	// Do nothing
        }, err => this.plateErrorHandler.error(err, 'savePlateBusinessPermissions'));
    }

    private emailIsValid(email) {
        var ampersandIndex = email.indexOf('@');
        if (ampersandIndex >= 1) {
            if (email.length > ampersandIndex) {
                var sub = email.substring(ampersandIndex + 1);
                var dotIndex = sub.indexOf('.');
                if (dotIndex > 0) {
                    sub = sub.substring(dotIndex + 1);
                    return sub.length > 0;
                }
            }
        }
        return false;
    }
    sendNewUserEmailClicked() {
        const email = this.newUserEmailText;
        if (!this.emailIsValid(email)) {
            this.plateToastService.toast({
                title: 'Email Not Valid',
                message: `Please supply a valid email`
            });
        } else {
            if (this.selectedTeam && email) {
                this.teamsService.invite(this.selectedTeam, email).subscribe(
                    (invitation) => {
                        this.plateToastService.toast({
                            title: 'Invitation Sent',
                            message: `Email sent to ${invitation.inviteeEmail}`
                        });
                    },
                    error => this.plateErrorHandler.error(error, 'send new user email clicked')
                )
            }
            this.newUserEmailText = '';
        }
        Analytics.default('Send User for Team Invite', 'sendNewUserEmailClicked()');
    }

    changeTeamClicked(team: UIClientTeam) {
        this.setTeam(team);
        Analytics.default('Change Team Clicked', 'changeTeamClicked()');
    }

    createAnotherTeamClicked() {
        this.selectedTeam = null;
        Analytics.default('Team Creation Clicked', 'createAnotherTeamClicked()');
    }

    teamColorSelected(color: string, team: UIClientTeam) {
        this.editingTeamColor = false;
        team.model.color = color;
        this.teamsService.update(team).subscribe(
            (result) => {
                // Do nothing
            }, error => this.plateErrorHandler.error(error, 'save team color clicked')
        )
        Analytics.default('Team Color Changed', 'teamColorSelected()');
    }

    newTeamClicked() {
        const teamName = this.newTeamNameText;
        const userInfo = this.plateAuthService.getUserInfo();
        let newTeam = new UIClientTeam({name: teamName}, this.teamsService);
        this.teamsService.create(newTeam).subscribe(
            team => this.newTeamRefresh(team),
            error => this.plateErrorHandler.error(error, 'new team clicked')
        )
        Analytics.default('New Team Clicked', 'newTeamClicked()');
    }

    joinTeamClicked(invitation: ClientTeamInvitation, index: number) {
        this.usersService.acceptTeamInvitation(invitation, this.teamsService).subscribe(
            team => {
                this.newTeamRefresh(team);
                this.homePlateService.emitJoinedNewTeam();
            },
            error => this.plateErrorHandler.error(error, 'join team clicked')
        )
        this.teamInvitations.splice(index, 1);
        Analytics.default('Join Team Clicked', 'joinTeamClicked()');
    }

    noThanksTeamClicked(invitation: ClientTeamInvitation, index: number) {
        // This should be in user service instead
        this.usersService.declineTeamInvitation(invitation).subscribe(
            null,
            error => this.plateErrorHandler.error(error, 'no thanks team clicked')
        )
        this.teamInvitations.splice(index, 1);
        Analytics.default('No Thanks Team Clicked', 'noThanksTeamClicked()');
    }

    uninviteMemberClicked(invitedMember: ClientTeamInvitation, index: number) {
        this.teamsService.deleteTeamInvitation(this.selectedTeam, invitedMember).subscribe(
            status => {
                // Do nothing
            },
            error => this.plateErrorHandler.error(error, 'uninvite member clicked')
        )
        Analytics.default('Team Member Uninvite Clicked', 'uninviteMemberClicked()');
    }

    editTeamNameClicked(selectedTeam: UIClientTeam) {
        this.editingTeamNameText = selectedTeam.model.name;
        this.editingTeamName = true;
    }

    saveEditTeamNameClicked() {
        this.selectedTeam.model.name = this.editingTeamNameText;
        this.teamsService.update(this.selectedTeam).subscribe(
            (result) => {
                this.editingTeamName = false;
            }, error => this.plateErrorHandler.error(error, 'save edit team name clicked')
        )
        Analytics.default('Team Edit Name Clicked', 'saveEditTeamNameClicked()');
    }

    cancelEditTeamNameClicked() {
        this.editingTeamNameText = '';
        this.editingTeamName = false;
    }

    memberPermissionClicked(member: UIClientTeamMember, role: 'admin' | 'user') {
        if (member.model.roleForTeam !== role) {
            member.model.roleForTeam = role;
            this.teamsService.saveTeamMember(this.selectedTeam, member).subscribe(
                (result) => {
                    // We may have changed ourselves
                    this.plateAuthService.refresh().subscribe(
                        (data) => {
                            this.userInfo = this.plateAuthService.getUserInfo();
                        }
                    );
                }, error => this.plateErrorHandler.error(error, 'member permission clicked')
            )
        }
        Analytics.default('Team Member Permission Changed', 'memberPermissionClicked()');
    }

    removeMemberFromTeamClicked(member: UIClientTeamMember, index: number) {
        this.teamsService.removeTeamMember(this.selectedTeam, member).subscribe(
            (result) => {
                // We may have changed ourselves
                this.selectedTeam.removeMember(member.model.id);
            }, error => this.plateErrorHandler.error(error, 'remove member from team clicked')
        )
        Analytics.default('Remove Member From Team', 'removeMemberFromTeamClicked()');
    }

    editTeamColorClicked(selectedTeam: UIClientTeam) {
        this.editingTeamColor = true;
    }

    // ------------------------------------------ Lifecycle
    ngAfterViewInit() {
        this.routerSubscription = this.route.params.subscribe(params => {
            let addNew = params['new'];
            if (addNew) {
                this.addTeamMemberFocus.emit(null);
            }
        });
    }

    ngOnDestroy() {
        if (this.routerSubscription) {
            this.routerSubscription.unsubscribe();
        }
    }

    // ------------------------------------------- UI State

    memberIsOwnerOfTeam(team: UIClientTeam, member: UIClientTeamMember) {
        return team.model.owner === member.model.id;
    }

    // ------------------------------------------- Utility
    private newTeamRefresh(team: UIClientTeam) {
        this.plateAuthService.refresh().subscribe(
            (data) => {
                this.userInfo = this.plateAuthService.getUserInfo();
                this.teamsService.get().subscribe(
                    (teams) => {
                        this.teams = teams;
                        this.setTeam(this.teams[this.teams.length - 1]);
                    },
                    error => this.plateErrorHandler.error(error, 'new team refresh')
                );
            }
        );
    }

    private setTeam (team: UIClientTeam) {
        this.selectedTeam = team;
        if (this.selectedTeam.isPlateBusiness) {
            this.permissionSets = Permissions.getPlateBusinessTeamPermissionSetForPermissions(this.selectedTeam.model.plateBusiness.permissions);
        }
        this.loading = false;
    }
}
