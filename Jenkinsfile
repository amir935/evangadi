// Jenkins pipeline: build the Vite frontend + prepare the Express backend,
// then deploy BOTH to cPanel shared hosting over SFTP.
//
// Runs on a Windows Jenkins controller/agent (PowerShell steps).
// See jenkins/SETUP.md for one-time setup (plugins, tools, credentials, cPanel).

pipeline {
  agent any

  // Requires the "NodeJS" plugin with an installation named exactly 'node22'
  // (Manage Jenkins > Tools > NodeJS installations). Remove this block if Node
  // 18+ is already on the Jenkins machine's PATH.
  tools { nodejs 'node22' }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  environment {
    // ---- EDIT THESE for your environment -------------------------------
    VITE_API_BASE   = 'https://api-evangadi.easywebsoft.com'  // baked into the frontend build
    DEPLOY_HOST     = 'easywebsoft.com'                       // cPanel FTP hostname
    DEPLOY_PORT     = '21'                                    // 21 = FTP/FTPS, 22 = SFTP
    DEPLOY_PROTOCOL = 'ftps'                                  // host has no SSH → FTPS (TLS). Use 'ftp' if TLS fails.
    // NOTE: over FTP the login root (/) IS the home dir (/home/easywebs), so these
    // paths are relative to home — no /home/easywebs prefix.
    FRONTEND_REMOTE = '/evangadi.easywebsoft.com'            // subdomain docroot (SPA)
    BACKEND_REMOTE  = '/evangadi-backend'                    // cPanel Node app "Application root"
    // --------------------------------------------------------------------

    // cPanel FTP/SSH login stored as a Jenkins "Username with password" credential.
    // Binds to DEPLOY_CREDS_USR and DEPLOY_CREDS_PSW.
    DEPLOY_CREDS = credentials('cpanel-deploy')
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build frontend') {
      steps {
        dir('evangadi2') {
          // VITE_API_BASE is read from the environment by Vite at build time.
          powershell '''
            $ErrorActionPreference = "Stop"
            node -v
            npm ci
            npm run build
          '''
        }
      }
    }

    stage('Prepare backend') {
      steps {
        dir('Backend') {
          // All backend deps are pure JS, so installing on Windows and shipping
          // to Linux is safe. --omit=dev keeps nodemon out of the upload.
          powershell '''
            $ErrorActionPreference = "Stop"
            npm ci --omit=dev
          '''
        }
      }
    }

    stage('Deploy frontend') {
      steps {
        powershell '''
          $ErrorActionPreference = "Stop"
          $env:DEPLOY_USER = $env:DEPLOY_CREDS_USR
          $env:DEPLOY_PASS = $env:DEPLOY_CREDS_PSW
          ./jenkins/deploy.ps1 `
            -LocalPath "evangadi2/dist" `
            -RemotePath $env:FRONTEND_REMOTE `
            -Protocol  $env:DEPLOY_PROTOCOL
        '''
      }
    }

    stage('Deploy backend') {
      steps {
        powershell '''
          $ErrorActionPreference = "Stop"
          $env:DEPLOY_USER = $env:DEPLOY_CREDS_USR
          $env:DEPLOY_PASS = $env:DEPLOY_CREDS_PSW
          # Ship source only. node_modules is installed on the server by cPanel
          # (Setup Node.js App > Run NPM Install) — FTP can't carry its symlinks.
          # Never overwrite the server .env, and skip .git/zip.
          ./jenkins/deploy.ps1 `
            -LocalPath "Backend" `
            -RemotePath $env:BACKEND_REMOTE `
            -Protocol  $env:DEPLOY_PROTOCOL `
            -FileMask  "|.env;.git/;*.zip;node_modules/" `
            -TouchRestart
        '''
      }
    }
  }

  post {
    success { echo '✅ Deployed frontend (public_html) + backend (Node app restarted).' }
    failure { echo '❌ Deploy failed — check the failing stage log above.' }
  }
}
