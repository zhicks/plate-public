export interface GmailSearchOptions {
    maxResults?: number;
    q?: string;
    id?: string;

    // Watch
    startHistoryId?: string
}

export interface GmailPostOptions {
    id?: string;
    urlSuffix?: string;

    addLabelIds?: string[];
    removeLabelIds?: string[];

    // Watch
    topicName?: string;
    labelIds?: string[];
}