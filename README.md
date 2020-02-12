# plate :fork_and_knife:

## Features
* Written in Angular 2
* Stack: MongoDB, Express, Angular 2, Node.js

## Needed Testing
* We will do these manually until we get automated testing in.

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
* ansible (`npm run ansible.setup`)

## Build
We use `gulp` for building the application. Configuration is in `gulpfile.js`. Tasks are in `tools/tasks`, and additional config is in `tools/config`.

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

## Deployment
Deployment is handled by Ansible. The playbooks are in `deploy/`.  `npm` scripts wrap the `ansible-playbook` commands. Check `package.json` for more information on `npm` scripts.

```
# Build the `production` package
npm run build.prod

# Build the `production` package and deploy to production servers
npm run build.deploy.prod

# Build the `production` package and deploy to staging servers
npm run build.deploy.staging
```

## Server Configuration
<center>Current Load Balancing Diagram:</center>

![diagram][diagram]
[diagram]: https://assets.digitalocean.com/articles/nginx_ssl_termination_load_balancing/nginx_ssl.png

**Fun Facts**
* SSH Keys: BigRedLinux and RCD Admin
* Private Networking Enabled
* OS: Ubuntu 16.04 x64
* Region: DigitalOcean NYC1
* See doc/config/server-init.sh for setup instructions
* See doc/config/ssh_config for host templates
* User: plate (no password, sudo)
* Root login disabled

### NOTE: As of December 14, 2017, the only server used is load.plate.work. The database has been moved to Mongo Atlas.

### Production Servers
#### Load Balancer Servers
* Firewall IPTABLES Config in `doc/config/load-iptables.conf`

**1. load.plate.work**
* IP: 192.241.156.89
* Private IP: 10.136.12.53
* Role: load balancer and SSL 
* Server: nginx
* SSL: /opt/secrets/plate/

#### Back-end App Servers
* Firewall: sudo iptables -I INPUT -m state --state NEW -p tcp --dport 80 ! -s 10.136.12.53 -j DROP
* Listens only on private port
* Firewall IPTABLES Config in `doc/config/prod-iptables.conf`

**1. prod-01.plate.work**
* IP: 192.241.157.192
* Private IP: 10.136.11.166

**2. prod-02.plate.work**
* IP: 192.241.156.153
* Private IP: 10.136.12.54

#### Database Servers
* Firewall IPTABLES Config in `doc/config/mongo-iptables.conf`
* To connect to production mongoDB, create an ssh tunnel. Then connect to mongo instance on localhost (use `mongo` shell or mongobooster). Authentication info is in `deploy/vars/prod-config.yml`

**1. mongo-01.plate.work**
* IP: 67.205.129.225
* Private IP: 10.136.11.247
* Region: DigitalOcean NYC1
* Server: none
* Listens only on private port


**Add this block to `~/.ssh/config`**
```
Host mongo-01.plate.work
  Hostname 67.205.129.225
  User plate
  Port 1204
  IdentityFile ~/.ssh/id_rsa
```

##### Database tasks:
###### 1. Create ssh tunnel

```
# Use npm shortcut to create tunnel
npm run ssh-tunnel.prod

# Use this for staging:
npm run ssh-tunnel.staging

# The underlying command: ssh -f -L 27000:localhost:27017 mongo-01.plate.work sleep 300
# -f flag puts process in the background
# -L flag creates the tunnel, using port 27000 on localhost and 27017 of remote host
# sleep 300 will kill the tunnel after 5 minutes if not used
# if tunnel is used by a process within 5 minutes, it will stay open until that process is closed (ie. mongo shell or mongobooster)


# Connect to mongodb using `mongo` shell
mongo localhost:27000/plate
db.auth('plate', 'PWD')
```

###### 2. Connect to mongodb using mongobooster (create ssh tunnel first):

* In Connection Editor -> Basic, 

  * Type: Direct Connection
  * Server: localhost
  * Port: 27000 (production) or 27001 (staging)
  * Name: plate

* In Connection Editor -> Authentication,

  * Mode: Basic(username/password)
  * Databse: plate
  * User name: plate
  * Password: located in `deploy/vars/prod-config.yml` and `deploy/vars/staging-config.yml`

###### 3. Back up database:

```
# Backup location: /home/plate/plate/db-backups
npm run db.backup.prod
npm run db.backup.staging
```

###### 4. Start mongod

```
mongod --fork --config /etc/mongod.conf
```

### Staging Servers
**staging-01.plate.work**
* IP: 192.241.141.148
* Region: DigitalOcean NYC1
* Server: apache2
* Listens only on private port

## Fun Facts
### Directories
client:
deploy: 
doc: 
server:

## Credits
### Some tools we use
  * https://jwt.io/
