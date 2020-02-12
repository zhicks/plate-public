declare const ga: any;

export class Analytics {
    /**
     * Sends an event to Google Analytics.
     * @param nounVerb The event category like Plate Item Add
     * @param relaventInfo The event label - such as the method name or header under which a task was made
     * @param action Default 'click'
     */
    static default(nounVerb: string, relaventInfo: string, action: string = 'click') {
        ga('send', {
            hitType: 'event',
            eventCategory: nounVerb,
            eventAction: action,
            eventLabel: relaventInfo
        });
    }
}