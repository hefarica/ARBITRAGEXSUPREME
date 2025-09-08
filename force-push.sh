#!/bin/bash
export GIT_ASKPASS=/bin/true  
export GIT_TERMINAL_PROMPT=0
git -c credential.helper="store --file=/home/user/.git-credentials" push origin main

