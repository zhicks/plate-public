import {filter} from "rxjs/operator/filter";
declare const moment;

import {Injectable} from "@angular/core";
import {UIClientPlateItem} from "../api/plateitems.service";

export interface ICurrentFilter {
    metrics: {
        [metricName: string]: {
            [metricValue: string]: string // also the metric value I think
        }
    },
    due: {
        time?: number,
        option: string
    }
}

@Injectable()
export class FilterService {

    currentFilter: ICurrentFilter = {
        metrics: {},
        due: {
            option: 'On'
        }
    };

    constructor(

    ) {}

    assignDueFilter(time: number, rangeSelection: string) {
        if (time) {
            this.currentFilter.due.time = time;
            this.currentFilter.due.option = rangeSelection;
        } else {
            this.removeDueFilter();
        }
    }
    removeDueFilter() {
        this.currentFilter.due.time = null;
    }

    assignOrRemoveMetricFilter(metric: string, value: string) {
        let doAdd = true;
        if (this.currentFilter.metrics[metric]) {
            if (this.currentFilter.metrics[metric][value]) {
                // We had the metric assigned - unassign it
                delete this.currentFilter.metrics[metric][value];
                if (!Object.keys(this.currentFilter.metrics[metric]).length) {
                    delete this.currentFilter.metrics[metric];
                }
                doAdd = false;
            }
        }
        if (doAdd) {
            this.currentFilter.metrics[metric] = this.currentFilter.metrics[metric] || {};
            this.currentFilter.metrics[metric][value] = value;
        }
    }

    private isFilteredOutByMetrics(plateItem: UIClientPlateItem) {
        let filterKeys = Object.keys(this.currentFilter.metrics);
        if (filterKeys.length) {
            if (plateItem.model.metrics && plateItem.model.metrics.length) {
                let hasAllCorrectMetricValues = true;
                for (let key of filterKeys) {
                    let foundMetric = false;
                    for (let itemMetric of plateItem.model.metrics) {
                        if (itemMetric.name === key && this.currentFilter.metrics[key][itemMetric.value]) {
                            foundMetric = true;
                            break;
                        }
                    }
                    if (!foundMetric) {
                        hasAllCorrectMetricValues = false;
                        break;
                    }
                }
                if (hasAllCorrectMetricValues) {
                    // Do not filter this item out
                    return false;
                } else {
                    // Filter it out
                    return true;
                }
            } else {
                // If the item has no metrics but we are filtering, filter it out
                return true;
            }
        }
        return false;
    }

    private isFilteredOutByDueDate(plateItem: UIClientPlateItem) {
        if (this.currentFilter.due.time) {
            if (plateItem.model.due) {
                // Modify for 0:00 if necessary - counts as whole day
                let itemMomentDate = moment(plateItem.model.due);
                let filterMomentDate = moment(this.currentFilter.due.time);
                if (filterMomentDate.hours() === 0 && filterMomentDate.minutes() === 0) {
                    itemMomentDate.hours(0).minutes(0);
                }
                let itemDueDateTime = itemMomentDate.toDate().getTime();
                switch (this.currentFilter.due.option) {
                    case 'Before':
                        return !(itemDueDateTime < this.currentFilter.due.time);
                    case 'On':
                        return !(itemDueDateTime === this.currentFilter.due.time);
                    case 'After':
                        return !(itemDueDateTime > this.currentFilter.due.time);
                }
            } else {
                // Plate item does not have a due date - filter out
                return true;
            }
        }
        return false;
    }

    isFilteredOut(plateItem: UIClientPlateItem) {
        let val =
            this.isFilteredOutByDueDate(plateItem) ||
            this.isFilteredOutByMetrics(plateItem);
        return val;
    }

    metricValueIsSelected(metricName: string, metricValue: string) {
        return this.currentFilter.metrics[metricName] && this.currentFilter.metrics[metricName][metricValue];
    }

    getValuesForMetric(metricName: string) {
        return Object.keys(this.currentFilter.metrics[metricName])
    }

}