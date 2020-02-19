# plate :fork_and_knife:

## Introduction
You're viewing some code for an application called Plate, which was a Trello-like project management app that connected to several APIs to help you organize your day. Plate featured real-time collaboration with teams, advanced searching across multiple applications, and a slick UI.
* This code is meant to be shown as an example of previous work; you can browse through some of the code and architecture by heading to the `src` directory.

## Stack
* MongoDB, Express, Angular 2, Node.js

### Registering
* Register via local
* Register via google
* Regiser via local when a google account exists
    * It should tell the user to log in with google
* Login via local
* Login via google
* Login via local when the account is only a google account
    * It should tell the user to log in with google
* Register / Login via google when the account is only a local
    * It should merge the account without really remarking on it
* Login via local when the account is both google and local
    * It should log in fine
* Login via google when the account is both google and local
    * It should log in fine

### Invites
* Send an invite to email A where email A is not a user. Register regular account with email A without clicking on the link.
* Send an invite to email A where email A is not a user. Register regular account with Google with email A without clicking on the link.
    * For all of these, the new user should have a notification and invitation. Accept and make sure invitation is destroyed.
* Send an invite to email A where email A is not a user. Register regular account with email A by clicking on the link.
* Send an invite to email A where email A is not a user. Register regular account with Google with email A by clicking on the link.
* Send an invite to email A where email A is not a user. Register regular account with email B by clicking on the link.
* Send an invite to email A where email A is not a user. Register regular account with Google with email B by clicking on the link.
    * For all of these, the new user should automatically be added to the team.
* Send an invite to email A where email A is a user. Notification and invitation should be there (upon refresh for now). 

## Installation

### Prerequisites
* npm (global)
* gulp (global)

## Build
`gulp` is used for building the application. Configuration is in `gulpfile.js`. Tasks are in `tools/tasks`, and additional config is in `tools/config`.

The default target is `development`. The output is `dist/dev`. Preceed the following commands with `NODE_ENV=production` to change the target to `production`. Pro tip: use `npm` to prep for production instead of `gulp`.

Examples:
```
# To build the entire application (`server` and `client`)
gulp build 

# To build the client
gulp build.client

# To build the server
gulp build.server

# To watch for changes (the server starts by default)
gulp watch

# To clean the `dist` folder
gulp clean
# Optionally, this will remove entire `dist` folder
gulp clean.all
```

