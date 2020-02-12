#! /bin/bash

# Create user and add to sudo
useradd -m -G sudo -s /bin/bash plate

# Copy authorized keys to plate user
mkdir /home/plate/.ssh
cp /root/.ssh/authorized_keys /home/plate/.ssh/authorized_keys
chown -R plate:plate /home/plate/.ssh
chmod 700 /home/plate/.ssh
chmod 600 /home/plate/.ssh/authorized_keys

# Harden server
sed -i 's|[#]*PasswordAuthentication yes|PasswordAuthentication no|g' /etc/ssh/sshd_config
sed -i 's|Port 22|Port 1204|g' /etc/ssh/sshd_config
sed -i 's|PermitRootLogin yes|PermitRootLogin no|g' /etc/ssh/sshd_config
service ssh restart

# Enable passwordless sudo access to plate
echo "plate ALL=(ALL) NOPASSWD: ALL" | (EDITOR="tee -a" visudo)

# Set vim as default editor
update-alternatives --set editor /usr/bin/vim.basic

apt-get update && apt-get upgrade -y

# Install web servers
if [[ $HOSTNAME == "load.plate.work" ]]; then
    apt-get install nginx
else
    apt-get install apache2
fi

# Install mongo
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
echo "deb http://repo.mongodb.org/apt/ubuntu trusty/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
apt-get update
apt-get install -y mongodb-org

# Add security to mongod.conf
sed -i 's|[#]*security:|security:\n  authorization: enabled|g' /etc/mongod.conf 

# Copy mongo service file
# /etc/systemd/system/mongod.service

# Create mongo db and users
mongo < mongo-init
