export interface SlackApiMessage {
    text: string;
    ts: string;
    type: string;
    user: string;
    channel?: string; // Custom
    team?: string; // Custom
    username?: string; // Custom
}

export interface SlackApiUser {
    "id": string,
    "name": string,
    "deleted": boolean,
    "color": string,
    "profile": {
        "first_name": string,
        "last_name": string,
        "real_name": string,
        "email": string,
        "skype": string,
        "phone": string,
        "image_24": string,
        "image_32": string,
        "image_48": string,
        "image_72": string,
        "image_192": string
    },
    "is_admin": boolean,
    "is_owner": boolean,
    "has_2fa": boolean,
    "has_files": boolean
}

export interface SimplifiedSlackUserObject {
    id?: string,
    name?: string,
    image_32?: string
}

export interface SlackApiMessageWithUserObj extends SlackApiMessage {
    userObj: SimplifiedSlackUserObject;
}

// UserGroup being a private channel
export interface SlackApiChannelOrUserGroup {
    "id": string,
    "name": string,
    "created": number,
    "creator": string,
    "is_archived": boolean,
    "is_member"?: boolean, // Not present in User Group
    "num_members"?: number, // Not present in User Group
    isPrivate?: boolean, // Custom
    "topic": {
        "value": string,
        "creator": string,
        "last_set": number
    },
    "purpose": {
        "value": string,
        "creator": string,
        "last_set": number
    }
}

export interface SlackApiSearchMatch {
    "type": string,
    "channel": {
        "id": string,
        "name": string
    },
    "user": string,
    "username": string,
    "ts": string,
    "text": string,
    "permalink": string,
    "previous_2": {
        "user": string,
        "username": string,
        "text": string,
        "ts": string,
        "type": string
    },
    "previous": {
        "user": string,
        "username": string,
        "text": string,
        "ts": string,
        "type": string
    },
    "next": {
        "user": string,
        "username": string,
        "text": string,
        "ts": string,
        "type": string
    },
    "next_2": {
        "user": string,
        "username": string,
        "text": string,
        "ts": string,
        "type": string
    }
}
