#!/bin/bash

# install Node LTS
mise use -g node@lts

# install Node Latest
# mise use -g node@latest

# cache clear
mise cache clear

npm install express-session
npm install socket.io
npm install express
npm install cookie-parser
