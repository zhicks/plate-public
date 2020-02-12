import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {UIClientPlateItem} from "../../../shared/api/plateitems.service";

@Injectable()
export class EditingPlateItemService {

    // Accessed directly from UI
    private editingPlateItem: UIClientPlateItem;
    private plateColor: string;
    private title: string;

    constructor(
        private router: Router
    ) { }

    getItem() {
        return this.editingPlateItem;
    }

    /**
     * Sets the item and navigates to the page to edit it.
     * @param item
     * @param color
     * @param title
     */
    setItem(item: UIClientPlateItem, color: string, title: string, navigate: boolean) {
        console.log(color);
        this.editingPlateItem = item;
        this.plateColor = color;
        this.title = title;

        if (navigate) {
            let id = item.model.id || 'new';
            this.router.navigate(['/item', id]);
        }
    }

    /**
     * Update color if already set
     * @param color
     */
    setColor(color) {
        this.plateColor = color;
    }

    /**
     * Does what setItem does but will get the item by HTTP.
     */
    setItemById(id: string, title: string) {
        this.title = title;
        this.router.navigate(['/item', id]);
    }

    unsetItem(navigate: boolean) {
        this.editingPlateItem = null;
        if (navigate) {
            this.router.navigate(['']);
        }
    }

}