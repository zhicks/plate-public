// Type definitions for Google Gmail API v1
// Project: https://developers.google.com/gmail/api/
// Definitions by: Bolisov Alexey
// Modified by Zack Hicks on July 26 2016

/// <reference path="../gapi/index.d.ts" />

declare module gapi.client.gmail {

    interface BatchDeleteMessagesRequest {
        // The IDs of the messages to delete.
        ids?: string[],
    }

    interface Draft {
        // The immutable ID of the draft.
        id?: string,
        // The message content of the draft.
        message?: Message,
    }

    interface History {
        // The mailbox sequence ID.
        id?: string,
        // Labels added to messages in this history record.
        labelsAdded?: HistoryLabelAdded[],
        // Labels removed from messages in this history record.
        labelsRemoved?: HistoryLabelRemoved[],
        // List of messages changed in this history record. The fields for specific change types, such as messagesAdded may duplicate messages in this field. We recommend using the specific change-type fields instead of this.
        messages?: Message[],
        // Messages added to the mailbox in this history record.
        messagesAdded?: HistoryMessageAdded[],
        // Messages deleted (not Trashed) from the mailbox in this history record.
        messagesDeleted?: HistoryMessageDeleted[],
    }

    interface HistoryLabelAdded {
        // Label IDs added to the message.
        labelIds?: string[],
        //
        message?: Message,
    }

    interface HistoryLabelRemoved {
        // Label IDs removed from the message.
        labelIds?: string[],
        //
        message?: Message,
    }

    interface HistoryMessageAdded {
        //
        message?: Message,
    }

    interface HistoryMessageDeleted {
        //
        message?: Message,
    }

    interface Label {
        // The immutable ID of the label.
        id?: string,
        // The visibility of the label in the label list in the Gmail web interface.
        labelListVisibility?: string,
        // The visibility of the label in the message list in the Gmail web interface.
        messageListVisibility?: string,
        // The total number of messages with the label.
        messagesTotal?: number,
        // The number of unread messages with the label.
        messagesUnread?: number,
        // The display name of the label.
        name?: string,
        // The total number of threads with the label.
        threadsTotal?: number,
        // The number of unread threads with the label.
        threadsUnread?: number,
        // The owner type for the label. User labels are created by the user and can be modified and deleted by the user and can be applied to any message or thread. System labels are internally created and cannot be added, modified, or deleted. System labels may be able to be applied to or removed from messages and threads under some circumstances but this is not guaranteed. For example, users can apply and remove the INBOX and UNREAD labels from messages and threads, but cannot apply or remove the DRAFTS or SENT labels from messages or threads.
        type?: string,
    }

    interface ListDraftsResponse {
        // List of drafts.
        drafts?: Draft[],
        // Token to retrieve the next page of results in the list.
        nextPageToken?: string,
        // Estimated total number of results.
        resultSizeEstimate?: number,
    }

    interface ListHistoryResponse {
        // List of history records. Any messages contained in the response will typically only have id and threadId fields populated.
        history?: History[],
        // The ID of the mailbox's current history record.
        historyId?: string,
        // Page token to retrieve the next page of results in the list.
        nextPageToken?: string,
    }

    interface ListLabelsResponse {
        // List of labels.
        labels?: Label[],
    }

    interface ListMessagesResponse {
        // List of messages.
        messages?: Message[],
        // Token to retrieve the next page of results in the list.
        nextPageToken?: string,
        // Estimated total number of results.
        resultSizeEstimate?: number,
    }

    interface ListThreadsResponse {
        // Page token to retrieve the next page of results in the list.
        nextPageToken?: string,
        // Estimated total number of results.
        resultSizeEstimate?: number,
        // List of threads.
        threads?: Thread[],
    }

    interface Message {
        // The ID of the last history record that modified this message.
        historyId?: string,
        // The immutable ID of the message.
        id?: string,
        // The internal message creation timestamp (epoch ms), which determines ordering in the inbox. For normal SMTP-received email, this represents the time the message was originally accepted by Google, which is more reliable than the Date header. However, for API-migrated mail, it can be configured by client to be based on the Date header.
        internalDate?: string,
        // List of IDs of labels applied to this message.
        labelIds?: string[],
        // The parsed email structure in the message parts.
        payload?: MessagePart,
        // The entire email message in an RFC 2822 formatted and base64url encoded string. Returned in messages.get and drafts.get responses when the format=RAW parameter is supplied.
        raw?: string,
        // Estimated size in bytes of the message.
        sizeEstimate?: number,
        // A short part of the message text.
        snippet?: string,
        // The ID of the thread the message belongs to. To add a message or draft to a thread, the following criteria must be met:
        // - The requested threadId must be specified on the Message or Draft.Message you supply with your request.
        // - The References and In-Reply-To headers must be set in compliance with the RFC 2822 standard.
        // - The Subject headers must match.
        threadId?: string,
    }

    interface MessagePart {
        // The message part body for this part, which may be empty for container MIME message parts.
        body?: MessagePartBody,
        // The filename of the attachment. Only present if this message part represents an attachment.
        filename?: string,
        // List of headers on this message part. For the top-level message part, representing the entire message payload, it will contain the standard RFC 2822 email headers such as To, From, and Subject.
        headers?: MessagePartHeader[],
        // The MIME type of the message part.
        mimeType?: string,
        // The immutable ID of the message part.
        partId?: string,
        // The child MIME message parts of this part. This only applies to container MIME message parts, for example multipart/*. For non- container MIME message part types, such as text/plain, this field is empty. For more information, see RFC 1521.
        parts?: MessagePart[],
    }

    interface MessagePartBody {
        // When present, contains the ID of an external attachment that can be retrieved in a separate messages.attachments.get request. When not present, the entire content of the message part body is contained in the data field.
        attachmentId?: string,
        // The body data of a MIME message part. May be empty for MIME container types that have no message body or when the body data is sent as a separate attachment. An attachment ID is present if the body data is contained in a separate attachment.
        data?: string,
        // Total number of bytes in the body of the message part.
        size?: number,
    }

    interface MessagePartHeader {
        // The name of the header before the : separator. For example, To.
        name?: string,
        // The value of the header after the : separator. For example, someuser@example.com.
        value?: string,
    }

    interface ModifyMessageRequest {
        // A list of IDs of labels to add to this message.
        addLabelIds?: string[],
        // A list IDs of labels to remove from this message.
        removeLabelIds?: string[],
    }

    interface ModifyThreadRequest {
        // A list of IDs of labels to add to this thread.
        addLabelIds?: string[],
        // A list of IDs of labels to remove from this thread.
        removeLabelIds?: string[],
    }

    interface Profile {
        // The user's email address.
        emailAddress?: string,
        // The ID of the mailbox's current history record.
        historyId?: string,
        // The total number of messages in the mailbox.
        messagesTotal?: number,
        // The total number of threads in the mailbox.
        threadsTotal?: number,
    }

    interface Thread {
        // The ID of the last history record that modified this thread.
        historyId?: string,
        // The unique ID of the thread.
        id?: string,
        // The list of messages in the thread.
        messages?: Message[],
        // A short part of the message text.
        snippet?: string,
    }

    interface WatchRequest {
        // Filtering behavior of labelIds list specified.
        labelFilterAction?: string,
        // List of label_ids to restrict notifications about. By default, if unspecified, all changes are pushed out. If specified then dictates which labels are required for a push notification to be generated.
        labelIds?: string[],
        // A fully qualified Google Cloud Pub/Sub API topic name to publish the events to. This topic name **must** already exist in Cloud Pub/Sub and you **must** have already granted gmail "publish" permission on it. For example, "projects/my-project-identifier/topics/my-topic-name" (using the Cloud Pub/Sub "v1" topic naming format).
        //
        // Note that the "my-project-identifier" portion must exactly match your Google developer project id (the one executing this watch request).
        topicName?: string,
    }

    interface WatchResponse {
        // When Gmail will stop sending notifications for mailbox updates (epoch millis). Call watch again before this time to renew the watch.
        expiration?: string,
        // The ID of the mailbox's current history record.
        historyId?: string,
    }

    interface DraftsResource {
        // Creates a new draft with the DRAFT label.
        create (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Draft>;

        // Immediately and permanently deletes the specified draft. Does not simply trash it.
        delete (request: {
            // The ID of the draft to delete.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Gets the specified draft.
        get (request: {
            // The format to return the draft in.
            format?: string,
            // The ID of the draft to retrieve.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Draft>;

        // Lists the drafts in the user's mailbox.
        list (request: {
            // Include drafts from SPAM and TRASH in the results.
            includeSpamTrash?: boolean,
            // Maximum number of drafts to return.
            maxResults?: number,
            // Page token to retrieve a specific page of results in the list.
            pageToken?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<ListDraftsResponse>;

        // Sends the specified, existing draft to the recipients in the To, Cc, and Bcc headers.
        send (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Replaces a draft's content.
        update (request: {
            // The ID of the draft to update.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Draft>;

    }


    interface HistoryResource {
        // Lists the history of all changes to the given mailbox. History results are returned in chronological order (increasing historyId).
        list (request: {
            // Only return messages with a label matching the ID.
            labelId?: string,
            // The maximum number of history records to return.
            maxResults?: number,
            // Page token to retrieve a specific page of results in the list.
            pageToken?: string,
            // Required. Returns history records after the specified startHistoryId. The supplied startHistoryId should be obtained from the historyId of a message, thread, or previous list response. History IDs increase chronologically but are not contiguous with random gaps in between valid IDs. Supplying an invalid or out of date startHistoryId typically returns an HTTP 404 error code. A historyId is typically valid for at least a week, but in some rare circumstances may be valid for only a few hours. If you receive an HTTP 404 error response, your application should perform a full sync. If you receive no nextPageToken in the response, there are no updates to retrieve and you can store the returned historyId for a future request.
            startHistoryId?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<ListHistoryResponse>;

    }


    interface LabelsResource {
        // Creates a new label.
        create (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Label>;

        // Immediately and permanently deletes the specified label and removes it from any messages and threads that it is applied to.
        delete (request: {
            // The ID of the label to delete.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Gets the specified label.
        get (request: {
            // The ID of the label to retrieve.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Label>;

        // Lists all labels in the user's mailbox.
        list (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<ListLabelsResponse>;

        // Updates the specified label. This method supports patch semantics.
        patch (request: {
            // The ID of the label to update.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Label>;

        // Updates the specified label.
        update (request: {
            // The ID of the label to update.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Label>;

    }


    interface AttachmentsResource {
        // Gets the specified message attachment.
        get (request: {
            // The ID of the attachment.
            id: string,
            // The ID of the message containing the attachment.
            messageId: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<MessagePartBody>;

    }


    interface MessagesResource {
        // Deletes many messages by message ID. Provides no guarantees that messages were not already deleted or even existed at all.
        batchDelete (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Immediately and permanently deletes the specified message. This operation cannot be undone. Prefer messages.trash instead.
        delete (request: {
            // The ID of the message to delete.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Gets the specified message.
        get (request: {
            // The format to return the message in.
            format?: string,
            // The ID of the message to retrieve.
            id: string,
            // When given and format is METADATA, only include headers specified.
            metadataHeaders?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Imports a message into only this user's mailbox, with standard email delivery scanning and classification similar to receiving via SMTP. Does not send a message.
        import (request: {
            // Mark the email as permanently deleted (not TRASH) and only visible in Google Apps Vault to a Vault administrator. Only used for Google Apps for Work accounts.
            deleted?: boolean,
            // Source for Gmail's internal date of the message.
            internalDateSource?: string,
            // Ignore the Gmail spam classifier decision and never mark this email as SPAM in the mailbox.
            neverMarkSpam?: boolean,
            // Process calendar invites in the email and add any extracted meetings to the Google Calendar for this user.
            processForCalendar?: boolean,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Directly inserts a message into only this user's mailbox similar to IMAP APPEND, bypassing most scanning and classification. Does not send a message.
        insert (request: {
            // Mark the email as permanently deleted (not TRASH) and only visible in Google Apps Vault to a Vault administrator. Only used for Google Apps for Work accounts.
            deleted?: boolean,
            // Source for Gmail's internal date of the message.
            internalDateSource?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Lists the messages in the user's mailbox.
        list (request: {
            // Include messages from SPAM and TRASH in the results.
            includeSpamTrash?: boolean,
            // Only return messages with labels that match all of the specified label IDs.
            labelIds?: string,
            // Maximum number of messages to return.
            maxResults?: number,
            // Page token to retrieve a specific page of results in the list.
            pageToken?: string,
            // Only return messages matching the specified query. Supports the same query format as the Gmail search box. For example, "from:someuser@example.com rfc822msgid: is:unread".
            q?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<ListMessagesResponse>;

        // Modifies the labels on the specified message.
        modify (request: {
            // The ID of the message to modify.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Sends the specified message to the recipients in the To, Cc, and Bcc headers.
        send (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Moves the specified message to the trash.
        trash (request: {
            // The ID of the message to Trash.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        // Removes the specified message from the trash.
        untrash (request: {
            // The ID of the message to remove from Trash.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Message>;

        attachments: AttachmentsResource,
    }


    interface ThreadsResource {
        // Immediately and permanently deletes the specified thread. This operation cannot be undone. Prefer threads.trash instead.
        delete (request: {
            // ID of the Thread to delete.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Gets the specified thread.
        get (request: {
            // The format to return the messages in.
            format?: string,
            // The ID of the thread to retrieve.
            id: string,
            // When given and format is METADATA, only include headers specified.
            metadataHeaders?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Thread>;

        // Lists the threads in the user's mailbox.
        list (request: {
            // Include threads from SPAM and TRASH in the results.
            includeSpamTrash?: boolean,
            // Only return threads with labels that match all of the specified label IDs.
            labelIds?: string,
            // Maximum number of threads to return.
            maxResults?: number,
            // Page token to retrieve a specific page of results in the list.
            pageToken?: string,
            // Only return threads matching the specified query. Supports the same query format as the Gmail search box. For example, "from:someuser@example.com rfc822msgid: is:unread".
            q?: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<ListThreadsResponse>;

        // Modifies the labels applied to the thread. This applies to all messages in the thread.
        modify (request: {
            // The ID of the thread to modify.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Thread>;

        // Moves the specified thread to the trash.
        trash (request: {
            // The ID of the thread to Trash.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Thread>;

        // Removes the specified thread from the trash.
        untrash (request: {
            // The ID of the thread to remove from Trash.
            id: string,
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Thread>;

    }


    interface UsersResource {
        // Gets the current user's Gmail profile.
        getProfile (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<Profile>;

        // Stop receiving push notifications for the given user mailbox.
        stop (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<void>;

        // Set up or update a push notification watch on the given user mailbox.
        watch (request: {
            // The user's email address. The special value me can be used to indicate the authenticated user.
            userId: string,
        }) : gapi.client.Request<WatchResponse>;

        drafts: DraftsResource,
        history: HistoryResource,
        labels: LabelsResource,
        messages: MessagesResource,
        threads: ThreadsResource,
    }

}

declare module gapi.client.gmail {
    var users: gapi.client.gmail.UsersResource;

}