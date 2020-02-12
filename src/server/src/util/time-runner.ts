import {PlateItem, IPlateItem} from "../models/plate-item";
import {Notification} from "../models/notifications";
const intervalTime = 10 * 60 * 1000; // 10 minutes
//const intervalTime = 5 * 1000; // 5 seconds - dev

class TimeRunner {

    private interval;

    init() {
        this.interval = setInterval(this.loop.bind(this), intervalTime);
    }

    private loop() {
        this.checkForDueDates();
    }

    private checkForDueDates() {
        PlateItem.getAllDueSoonThatNeedNotifications().then((plateItems) => {
            const now = Date.now();
            const tomorrow = now + 24*60*60*1000;
            const thirtyMinutesFromNow = now + 30*60*1000;

            let toNotifyOneDayLeft: IPlateItem[] = [];
            let toNotifyThirtyMinutesLeft: IPlateItem[] = [];
            let toNotifyPastDue: IPlateItem[] = [];
            for (let plateItem of plateItems) {
                if (plateItem.due < now) {
                    toNotifyPastDue.push(plateItem);
                } else if (plateItem.numNotifiedDue < 2 && plateItem.due < thirtyMinutesFromNow) {
                    toNotifyThirtyMinutesLeft.push(plateItem);
                } else if (plateItem.numNotifiedDue < 1 && plateItem.due < tomorrow) {
                    toNotifyOneDayLeft.push(plateItem);
                }
            }

            for (let plateItem of toNotifyOneDayLeft) {
                plateItem.setDueNotifiedNum(1);
                Notification.notifyPlateItemDue(plateItem);
            }
            for (let plateItem of toNotifyThirtyMinutesLeft) {
                plateItem.setDueNotifiedNum(2);
                Notification.notifyPlateItemDue(plateItem);
            }
            for (let plateItem of toNotifyPastDue) {
                plateItem.setDueNotifiedNum(3);
                Notification.notifyPlateItemDue(plateItem);
            }

            // console.log('one day left' + toNotifyOneDayLeft.length);
            // console.log('30 mins left' + toNotifyThirtyMinutesLeft.length);
            // console.log('now' + toNotifyPastDue.length);

        }).catch((reason) => {
            console.error(reason);
        })
    }

}

export const timeRunner = new TimeRunner();